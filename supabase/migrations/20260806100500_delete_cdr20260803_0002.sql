-- Explicit request from thitiwat.tan@tgm.co.th (admin) to permanently
-- delete CDR-20260803-0002. Confirmed safe: status CANCELLED, no line has
-- an actual received quantity recorded, no withdrawal line references it,
-- and its bridged receiving document (RCV-CDR-20260803-0002) is still
-- DRAFT/unposted — no real stock movement or balance depends on it.
--
-- Mirrors exactly what tgd_admin_delete_customer_deposit_request
-- (20260806100000) does, run directly here since a migration script has
-- no auth.uid() session to call that RPC through.

begin;

do $$
declare
  v_request_id uuid := 'c9059b17-0422-4435-bc7f-35022ac283bb';
  v_document record;
  v_lines_snapshot jsonb;
  v_line_count int;
  v_actor_id uuid := '44444444-4444-4444-8444-444444444444';
  v_actor_email text := 'thitiwat.tan@tgm.co.th';
  v_actor_role text := 'admin';
begin
  select * into v_document
  from public.tgd_customer_deposit_requests
  where id = v_request_id and request_no = 'CDR-20260803-0002'
  for update;

  if not found then
    raise exception 'CDR-20260803-0002 not found or id mismatch — aborting to avoid deleting the wrong document';
  end if;

  if v_document.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') then
    raise exception 'Refusing to delete: status is %, which means real stock movements exist', v_document.status;
  end if;

  if exists (
    select 1 from public.tgd_customer_deposit_request_lines l
    where l.deposit_request_id = v_request_id
      and (l.actual_boxes is not null or l.actual_weight is not null)
  ) then
    raise exception 'Refusing to delete: a line has an actual received quantity recorded';
  end if;

  if exists (
    select 1 from public.tgd_customer_withdrawal_request_lines wl
    where wl.source_customer_deposit_request_id = v_request_id
       or wl.source_customer_deposit_request_line_id in (
         select id from public.tgd_customer_deposit_request_lines where deposit_request_id = v_request_id
       )
  ) then
    raise exception 'Refusing to delete: a withdrawal line already references this document';
  end if;

  select coalesce(jsonb_agg(l.*), '[]'::jsonb), count(*)
  into v_lines_snapshot, v_line_count
  from public.tgd_customer_deposit_request_lines l
  where l.deposit_request_id = v_request_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_request_id, v_document.customer_id,
    'ADMIN_DELETE_DOCUMENT', v_document.status, 'DELETED',
    v_actor_id, v_actor_email, v_actor_role, null,
    'ลบเอกสารตามคำขอของแอดมิน',
    jsonb_build_object(
      'request_no', v_document.request_no,
      'header_snapshot', to_jsonb(v_document),
      'line_count', v_line_count,
      'lines_snapshot', v_lines_snapshot
    )
  );

  delete from public.tgd_customer_deposit_receiving_links
  where customer_deposit_request_id = v_request_id;

  delete from public.tgd_receiving_documents
  where source_customer_deposit_request_id = v_request_id
    and status = 'DRAFT';

  delete from public.tgd_customer_deposit_request_lines
  where deposit_request_id = v_request_id;

  delete from public.tgd_customer_deposit_requests
  where id = v_request_id;

  raise notice 'Deleted CDR-20260803-0002 (% lines) — logged as ADMIN_DELETE_DOCUMENT', v_line_count;
end $$;

commit;
