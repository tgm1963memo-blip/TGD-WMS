-- Migration 085: Fix "is not unique" error on tgd_enqueue_customer_request_notifications
-- Root cause: multiple function overloads exist in the DB (e.g. 4-param + 5-param with default),
-- causing PostgreSQL to fail resolving the call inside tgd_submit_customer_deposit_request.
-- Fix: drop ALL overloads, recreate a single canonical 5-param version, recompile callers.

begin;

-- 1. Drop all known overloads (covers 4-param, 5-param required, 5-param with default, 6-param)
drop function if exists public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text);
drop function if exists public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text);
drop function if exists public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text, text);

-- 2. Recreate single canonical version
create function public.tgd_enqueue_customer_request_notifications(
  p_document_type text,
  p_document_id uuid,
  p_customer_id uuid,
  p_document_no text,
  p_submitter_email text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_email text;
  v_kind_label text;
  v_subject text;
  v_body text;
  v_count integer := 0;
  v_recipient record;
begin
  select nullif(btrim(c.contact_email), '')
  into v_customer_email
  from public.tgd_customers c
  where c.id = p_customer_id;

  if p_document_type in ('CUSTOMER_DEPOSIT_REQUEST', 'DEPOSIT') then
    v_kind_label := 'ใบแจ้งฝากสินค้า';
  elsif p_document_type in ('CUSTOMER_WITHDRAWAL_REQUEST', 'WITHDRAWAL') then
    v_kind_label := 'ใบแจ้งเบิกสินค้า';
  else
    v_kind_label := 'คำขอลูกค้า';
  end if;

  v_subject := format('[%s] %s — %s', p_document_no, v_kind_label, 'ยืนยันการส่งคำขอ');
  v_body := format(
    'ลูกค้าส่ง%s %s เรียบร้อยแล้ว ระบบบันทึกสถานะ SUBMITTED_BY_CUSTOMER',
    v_kind_label,
    coalesce(p_document_no, p_document_id::text)
  );

  if v_customer_email is not null then
    insert into public.tgd_customer_request_email_queue (
      document_type, document_id, customer_id, document_no,
      recipient_email, recipient_role, notification_kind, subject, body_preview
    ) values (
      p_document_type, p_document_id, p_customer_id, p_document_no,
      v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
    );
    v_count := v_count + 1;
  end if;

  if nullif(btrim(p_submitter_email), '') is not null
     and lower(btrim(p_submitter_email)) is distinct from lower(coalesce(v_customer_email, '')) then
    insert into public.tgd_customer_request_email_queue (
      document_type, document_id, customer_id, document_no,
      recipient_email, recipient_role, notification_kind, subject, body_preview
    ) values (
      p_document_type, p_document_id, p_customer_id, p_document_no,
      btrim(p_submitter_email), 'customer_submitter', 'CUSTOMER_CONFIRMATION', v_subject, v_body
    );
    v_count := v_count + 1;
  end if;

  v_subject := format('[%s] %s — %s', p_document_no, v_kind_label, 'แจ้งธุรการ/คลัง');
  v_body := format(
    'มี%sใหม่จากลูกค้า: %s — โปรดตรวจสอบในระบบ WMS',
    v_kind_label,
    coalesce(p_document_no, p_document_id::text)
  );

  for v_recipient in
    select distinct nullif(btrim(p.email), '') as email, p.role
    from public.tgd_user_profiles p
    where p.is_active = true
      and p.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
      and nullif(btrim(p.email), '') is not null
  loop
    insert into public.tgd_customer_request_email_queue (
      document_type, document_id, customer_id, document_no,
      recipient_email, recipient_role, notification_kind, subject, body_preview
    ) values (
      p_document_type, p_document_id, p_customer_id, p_document_no,
      v_recipient.email, v_recipient.role, 'OPERATIONS_ALERT', v_subject, v_body
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text) from public;
grant execute on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text) to authenticated;

-- 3. Recompile tgd_submit_customer_deposit_request so it resolves against the single overload
create or replace function public.tgd_submit_customer_deposit_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_request_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status, d.request_no into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;
  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before submission'; end if;

  v_request_no := v_document.request_no;

  update public.tgd_customer_deposit_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_DEPOSIT_REQUEST'::text, v_document.id, v_document.customer_id, v_request_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

-- 4. Recompile tgd_submit_customer_withdrawal_request (from migration 079 fix)
create or replace function public.tgd_submit_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_withdrawal_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status, w.withdrawal_no into v_document
  from public.tgd_customer_withdrawal_requests w where w.id = p_request_id for update;
  if not found then raise exception 'Customer withdrawal request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'WITHDRAWAL_DRAFT' then raise exception 'Withdrawal request must be DRAFT before submission'; end if;

  v_withdrawal_no := v_document.withdrawal_no;

  update public.tgd_customer_withdrawal_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_WITHDRAWAL_REQUEST'::text, v_document.id, v_document.customer_id, v_withdrawal_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

commit;
