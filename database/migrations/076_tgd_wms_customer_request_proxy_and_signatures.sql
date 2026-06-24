-- 076_tgd_wms_customer_request_proxy_and_signatures.sql
-- Fixes update and delete RPCs for deposit/withdrawal drafts to use proxy access rules.
-- Adds handheld_received_by_email and web_approved_by_email to deposit requests and backfills them.

begin;

-- 1. Add signature columns
alter table public.tgd_customer_deposit_requests
  add column if not exists handheld_received_by_email text,
  add column if not exists handheld_received_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists web_approved_by_email text,
  add column if not exists web_approved_by_user_id uuid references public.tgd_user_profiles(id);

alter table public.tgd_customer_withdrawal_requests
  add column if not exists handheld_received_by_email text,
  add column if not exists handheld_received_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists web_approved_by_email text,
  add column if not exists web_approved_by_user_id uuid references public.tgd_user_profiles(id);

-- 2. Fix Deposit Draft RPCs
create or replace function public.tgd_update_customer_deposit_request_draft(
  p_request_id uuid,
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null
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

  if not found then
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'DRAFT' then
    raise exception 'Deposit request must be DRAFT before update';
  end if;

  update public.tgd_customer_deposit_requests
  set expected_arrival_date = p_expected_arrival_date,
      contact_name = nullif(btrim(p_contact_name), ''),
      contact_phone = nullif(btrim(p_contact_phone), ''),
      note = nullif(btrim(p_note), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'UPDATE_DRAFT', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_document.status,
    'action', 'UPDATE_DRAFT'
  );
end;
$$;

create or replace function public.tgd_delete_customer_deposit_request_line(
  p_request_id uuid,
  p_line_id uuid
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

  if not found then
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'DRAFT' then
    raise exception 'Deposit request must be DRAFT before deleting lines';
  end if;

  delete from public.tgd_customer_deposit_request_lines
  where id = p_line_id and deposit_request_id = v_document.id;

  if found then
    insert into public.tgd_customer_document_timeline_events (
      document_type, document_id, customer_id, action, from_status, to_status,
      actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
    ) values (
      'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
      'DELETE_LINE', v_document.status, v_document.status,
      v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
      null,
      jsonb_build_object('line_id', p_line_id)
    );
  end if;

  return jsonb_build_object(
    'id', v_document.id,
    'deleted_line_id', p_line_id,
    'status', v_document.status,
    'action', 'DELETE_LINE'
  );
end;
$$;

-- 3. Fix Withdrawal Draft RPCs
create or replace function public.tgd_update_customer_withdrawal_request_draft(
  p_request_id uuid,
  p_requested_dispatch_date date,
  p_delivery_type text,
  p_pickup_contact text,
  p_destination text,
  p_note text default null
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

  if not found then
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'WITHDRAWAL_DRAFT' then
    raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before update';
  end if;

  update public.tgd_customer_withdrawal_requests
  set requested_dispatch_date = p_requested_dispatch_date,
      delivery_type = nullif(btrim(p_delivery_type), ''),
      pickup_contact = nullif(btrim(p_pickup_contact), ''),
      destination = nullif(btrim(p_destination), ''),
      note = nullif(btrim(p_note), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'UPDATE_DRAFT', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_document.status,
    'action', 'UPDATE_DRAFT'
  );
end;
$$;

create or replace function public.tgd_delete_customer_withdrawal_request_line(
  p_request_id uuid,
  p_line_id uuid
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

  if not found then
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'WITHDRAWAL_DRAFT' then
    raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before deleting lines';
  end if;

  delete from public.tgd_customer_withdrawal_request_lines
  where id = p_line_id and withdrawal_request_id = v_document.id;

  if found then
    insert into public.tgd_customer_document_timeline_events (
      document_type, document_id, customer_id, action, from_status, to_status,
      actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
    ) values (
      'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
      'DELETE_LINE', v_document.status, v_document.status,
      v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
      null,
      jsonb_build_object('line_id', p_line_id)
    );
  end if;

  return jsonb_build_object(
    'id', v_document.id,
    'deleted_line_id', p_line_id,
    'status', v_document.status,
    'action', 'DELETE_LINE'
  );
end;
$$;

-- 4. Update Deposit Review to capture Web Approved By
create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
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
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_receiving_id uuid;
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

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, or CONFIRM_RECEIPT';
  end if;

  -- CONFIRM_RECEIPT allows warehouse roles
  if v_decision = 'CONFIRM_RECEIPT' then
    if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
      raise exception 'Admin, accounting, or warehouse role required to confirm deposit receiving';
    end if;
  else
    if v_profile.role not in ('admin', 'accounting') then
      raise exception 'Admin or accounting role required to review a deposit request';
    end if;
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'CONFIRM_RECEIPT' and v_document.status in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') then
    v_to_status := 'RECEIVED_CONFIRMED';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_deposit_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      web_approved_by_user_id = case when v_decision = 'CONFIRM_RECEIPT' then v_profile.id else web_approved_by_user_id end,
      web_approved_by_email = case when v_decision = 'CONFIRM_RECEIPT' then v_profile.email else web_approved_by_email end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    'action', 'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
end;
$$;

-- 5. Update deposit line actual receipt to capture Handheld Received By
create or replace function public.tgd_record_deposit_line_actual_receipt(
  p_line_id uuid,
  p_actual_boxes numeric default null,
  p_actual_weight numeric default null,
  p_actual_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_line record;
  v_document record;
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

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse role required to record actual receipt';
  end if;

  select l.id, l.deposit_request_id, l.expected_boxes, l.expected_weight, l.line_no
  into v_line
  from public.tgd_customer_deposit_request_lines l
  where l.id = p_line_id
  for update;

  if not found then
    raise exception 'Deposit line not found';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = v_line.deposit_request_id
  for update;

  if v_document.status not in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED', 'RECEIVED_CONFIRMED') then
    raise exception 'Request must be in receiving state to record actuals';
  end if;

  update public.tgd_customer_deposit_request_lines
  set actual_boxes = coalesce(p_actual_boxes, actual_boxes, expected_boxes),
      actual_weight = coalesce(p_actual_weight, actual_weight, expected_weight),
      actual_note = coalesce(nullif(btrim(p_actual_note), ''), actual_note)
  where id = v_line.id;

  update public.tgd_customer_deposit_requests
  set handheld_received_by_user_id = v_profile.id,
      handheld_received_by_email = v_profile.email,
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'RECORD_ACTUAL', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_actual_note), ''),
    jsonb_build_object(
      'line_id', v_line.id,
      'line_no', v_line.line_no,
      'actual_boxes', coalesce(p_actual_boxes, v_line.expected_boxes),
      'actual_weight', coalesce(p_actual_weight, v_line.expected_weight)
    )
  );

  return jsonb_build_object(
    'line_id', v_line.id,
    'deposit_request_id', v_document.id,
    'status', v_document.status,
    'action', 'RECORD_ACTUAL'
  );
end;
$$;

-- 6. Backfill existing records
update public.tgd_customer_deposit_requests cdr
set handheld_received_by_user_id = (
      select actor_user_id from public.tgd_customer_document_timeline_events
      where document_id = cdr.id and action = 'RECORD_ACTUAL'
      order by created_at desc limit 1
    ),
    handheld_received_by_email = (
      select actor_email from public.tgd_customer_document_timeline_events
      where document_id = cdr.id and action = 'RECORD_ACTUAL'
      order by created_at desc limit 1
    )
where handheld_received_by_email is null;

update public.tgd_customer_deposit_requests cdr
set web_approved_by_user_id = (
      select actor_user_id from public.tgd_customer_document_timeline_events
      where document_id = cdr.id and action = 'REVIEW_CONFIRM_RECEIPT'
      order by created_at desc limit 1
    ),
    web_approved_by_email = (
      select actor_email from public.tgd_customer_document_timeline_events
      where document_id = cdr.id and action = 'REVIEW_CONFIRM_RECEIPT'
      order by created_at desc limit 1
    )
where web_approved_by_email is null;

-- Grant execution
grant execute on function public.tgd_update_customer_deposit_request_draft(uuid, date, text, text, text) to authenticated;
grant execute on function public.tgd_delete_customer_deposit_request_line(uuid, uuid) to authenticated;
grant execute on function public.tgd_update_customer_withdrawal_request_draft(uuid, date, text, text, text, text) to authenticated;
grant execute on function public.tgd_delete_customer_withdrawal_request_line(uuid, uuid) to authenticated;

commit;
