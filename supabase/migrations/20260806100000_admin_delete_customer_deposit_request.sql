-- Lets an admin permanently delete a customer deposit request that never
-- had real inventory impact (no confirmed receipt, no withdrawal already
-- drawing against it) — e.g. a duplicate or mistakenly-created document.
-- Unlike Cancel (which just changes status and keeps the document visible
-- forever), this actually removes the header/lines from the working
-- tables, but logs a full snapshot to tgd_customer_document_timeline_events
-- BEFORE deleting so there's a permanent audit trail of what existed and
-- who removed it, even though the row itself is gone.

begin;

create or replace function public.tgd_admin_delete_customer_deposit_request(
  p_request_id uuid,
  p_reason text default null
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
  v_lines_snapshot jsonb;
  v_line_count int;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role <> 'admin' then
    raise exception 'Admin role required to permanently delete a deposit request';
  end if;

  select *
  into v_document
  from public.tgd_customer_deposit_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  -- Safety: only documents that never had a confirmed receipt can be
  -- deleted here — RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED mean real stock
  -- movements/balances already exist for this document (use Cancel or the
  -- recall flow for those instead, never a hard delete).
  if v_document.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') then
    raise exception 'Cannot delete a document that has already had its receipt confirmed (status %) — cancel or recall it instead', v_document.status;
  end if;

  if exists (
    select 1 from public.tgd_customer_deposit_request_lines l
    where l.deposit_request_id = p_request_id
      and (l.actual_boxes is not null or l.actual_weight is not null)
  ) then
    raise exception 'Cannot delete a document with a recorded actual received quantity on any line';
  end if;

  if exists (
    select 1
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.source_customer_deposit_request_id = p_request_id
       or wl.source_customer_deposit_request_line_id in (
         select id from public.tgd_customer_deposit_request_lines where deposit_request_id = p_request_id
       )
  ) then
    raise exception 'Cannot delete a document that already has withdrawal lines referencing it';
  end if;

  select coalesce(jsonb_agg(l.*), '[]'::jsonb), count(*)
  into v_lines_snapshot, v_line_count
  from public.tgd_customer_deposit_request_lines l
  where l.deposit_request_id = p_request_id;

  -- Log BEFORE deleting, with a full header+lines snapshot, so the trail
  -- is self-contained even once the document itself no longer exists.
  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', p_request_id, v_document.customer_id,
    'ADMIN_DELETE_DOCUMENT', v_document.status, 'DELETED',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'request_no', v_document.request_no,
      'header_snapshot', to_jsonb(v_document),
      'line_count', v_line_count,
      'lines_snapshot', v_lines_snapshot
    )
  );

  -- The bridged receiving document (if the request had reached
  -- ACCEPT/WAREHOUSE_RECEIVING) is still DRAFT at this point — CONFIRM_
  -- RECEIPT is what posts it and creates stock movements, and that path is
  -- already blocked above — so removing it here has no stock impact.
  delete from public.tgd_receiving_documents
  where source_customer_deposit_request_id = p_request_id
    and status = 'DRAFT';

  delete from public.tgd_customer_deposit_request_lines
  where deposit_request_id = p_request_id;

  delete from public.tgd_customer_deposit_requests
  where id = p_request_id;

  return jsonb_build_object(
    'id', p_request_id,
    'request_no', v_document.request_no,
    'deleted', true,
    'lines_deleted', v_line_count
  );
end;
$$;

revoke all on function public.tgd_admin_delete_customer_deposit_request(uuid, text) from public;
grant execute on function public.tgd_admin_delete_customer_deposit_request(uuid, text) to authenticated;

commit;
