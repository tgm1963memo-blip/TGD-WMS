-- Lets admin/approver staff pull a customer withdrawal request that was
-- reviewed/accepted/sent to picking back to SUBMITTED_BY_CUSTOMER, e.g.
-- when it was approved too early. Until now this had to be done directly
-- in the database (CWR-20261113-0014 on 2026-11-16, CWR-20261119-0003/0004
-- and CWR-20261120-0003/0004 on 2026-11-20/21); this RPC is the same
-- procedure with the actor recorded in the timeline.
--
-- What ACCEPT did, and what this undoes:
--   * reviewed_by_* / reviewed_at / review_comment       -> cleared
--   * confirmed_dispatch_* (set from requested date)      -> cleared, so a
--     re-ACCEPT sets it again from the (possibly edited) requested date
--   * tgd_bridge_customer_withdrawal_to_internal created a DRAFT
--     tgd_withdrawal_requests row + lines + execution links -> deleted, so
--     a re-ACCEPT bridges the current lines afresh (the bridge is
--     idempotent on execution links, so leaving them would keep stale
--     lines if the customer edits the request in between)
--
-- Refused when real warehouse work exists: any recorded pick on a line,
-- a dispatch time already started, or a picking document / allocation
-- record hanging off the bridged internal request. Line data (thaw flag,
-- admin notes, requested qty) is left untouched.

begin;

create or replace function public.tgd_admin_recall_withdrawal_to_submitted(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_count integer;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then
    raise exception 'User profile not found';
  end if;

  -- Same permission as ACCEPT, since this undoes an acceptance.
  if not public.tgd_role_function_allowed(
       v_profile.role, 'customer_request_approve',
       v_profile.role in ('admin', 'accounting')
     ) then
    raise exception 'ไม่มีสิทธิ์ถอยสถานะใบเบิก (ต้องมีสิทธิ์อนุมัติคำขอลูกค้า)';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no, w.dispatch_started_at
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status not in ('ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING') then
    raise exception 'ถอยกลับเป็นลูกค้าส่งได้เฉพาะใบที่อยู่ระหว่างตรวจสอบ/อนุมัติแล้ว/กำลังจัดสินค้า (สถานะปัจจุบัน: %)', v_document.status;
  end if;

  if v_document.dispatch_started_at is not null then
    raise exception 'ถอยสถานะไม่ได้: เริ่มบันทึกเวลาจ่ายสินค้าแล้ว';
  end if;

  select count(*) into v_count
  from public.tgd_customer_withdrawal_request_lines l
  where l.withdrawal_request_id = v_document.id
    and (l.picked_boxes is not null or l.picked_weight is not null or l.picked_at is not null);
  if v_count > 0 then
    raise exception 'ถอยสถานะไม่ได้: มีการหยิบสินค้าแล้ว % รายการ', v_count;
  end if;

  select count(*) into v_count
  from public.tgd_picking_documents p
  join public.tgd_withdrawal_requests w on w.id = p.withdrawal_request_id
  where w.source_customer_withdrawal_request_id = v_document.id;
  if v_count > 0 then
    raise exception 'ถอยสถานะไม่ได้: มีใบหยิบสินค้าแล้ว';
  end if;

  select count(*) into v_count
  from public.tgd_allocation_records a
  join public.tgd_withdrawal_request_lines l on l.id = a.withdrawal_line_id
  join public.tgd_withdrawal_requests w on w.id = l.request_id
  where w.source_customer_withdrawal_request_id = v_document.id;
  if v_count > 0 then
    raise exception 'ถอยสถานะไม่ได้: มีการจองสต็อกแล้ว';
  end if;

  delete from public.tgd_customer_withdrawal_execution_links
  where customer_withdrawal_request_id = v_document.id;

  delete from public.tgd_withdrawal_request_lines l
  using public.tgd_withdrawal_requests w
  where l.request_id = w.id
    and w.source_customer_withdrawal_request_id = v_document.id
    and w.status = 'DRAFT';

  delete from public.tgd_withdrawal_requests
  where source_customer_withdrawal_request_id = v_document.id
    and status = 'DRAFT';

  update public.tgd_customer_withdrawal_requests
  set status                      = 'SUBMITTED_BY_CUSTOMER',
      reviewed_by_user_id         = null,
      reviewed_by_email           = null,
      reviewed_at                 = null,
      review_comment              = null,
      confirmed_dispatch_date     = null,
      confirmed_dispatch_by_email = null,
      confirmed_dispatch_at       = null,
      last_action_by_user_id      = v_profile.id,
      last_action_by_email        = v_profile.email,
      last_action_at              = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'ADMIN_RECALL_TO_SUBMITTED', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'withdrawal_no', v_document.withdrawal_no,
    'status', 'SUBMITTED_BY_CUSTOMER',
    'action', 'ADMIN_RECALL_TO_SUBMITTED'
  );
end;
$$;

revoke all on function public.tgd_admin_recall_withdrawal_to_submitted(uuid, text) from public, anon;
grant execute on function public.tgd_admin_recall_withdrawal_to_submitted(uuid, text) to authenticated;

commit;
