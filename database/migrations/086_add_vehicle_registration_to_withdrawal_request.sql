-- 086_add_vehicle_registration_to_withdrawal_request.sql
-- Add vehicle_registration field to customer withdrawal requests
-- and update the create/update draft RPCs to accept and store it.

begin;

-- 1. Add column
alter table public.tgd_customer_withdrawal_requests
  add column if not exists vehicle_registration text;

-- 2. Replace create RPC — drop old overload (5 text + uuid) then recreate with new param
drop function if exists public.tgd_create_customer_withdrawal_request(date, text, text, text, text, uuid);

create or replace function public.tgd_create_customer_withdrawal_request(
  p_requested_dispatch_date date,
  p_delivery_type text,
  p_pickup_contact text,
  p_destination text,
  p_note text default null,
  p_customer_id uuid default null,
  p_vehicle_registration text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_target_customer_id uuid;
  v_day text := to_char(timezone('utc', now()), 'YYYYMMDD');
  v_seq integer;
  v_withdrawal_no text;
  v_request_id uuid;
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

  v_target_customer_id := public.tgd_resolve_customer_request_target_id(
    v_profile.role, v_profile.customer_id, p_customer_id
  );

  perform pg_advisory_xact_lock(hashtext('cwr:' || v_target_customer_id::text || ':' || v_day));

  select coalesce(max(
    nullif(regexp_replace(w.withdrawal_no, '^CWR-' || v_day || '-', ''), '')::integer
  ), 0) + 1
  into v_seq
  from public.tgd_customer_withdrawal_requests w
  where w.withdrawal_no like 'CWR-' || v_day || '-%';

  v_withdrawal_no := format('CWR-%s-%s', v_day, lpad(v_seq::text, 4, '0'));

  insert into public.tgd_customer_withdrawal_requests (
    withdrawal_no, customer_id, status,
    requested_dispatch_date, delivery_type, pickup_contact, destination, note,
    vehicle_registration,
    created_by_user_id, created_by_email, created_by_display_name, created_by_role,
    last_action_by_user_id, last_action_by_email, last_action_at
  ) values (
    v_withdrawal_no, v_target_customer_id, 'WITHDRAWAL_DRAFT',
    p_requested_dispatch_date, nullif(btrim(p_delivery_type), ''),
    nullif(btrim(p_pickup_contact), ''), nullif(btrim(p_destination), ''),
    nullif(btrim(p_note), ''),
    nullif(btrim(p_vehicle_registration), ''),
    v_profile.id, v_profile.email, null, v_profile.role,
    v_profile.id, v_profile.email, now()
  )
  returning id into v_request_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_request_id, v_target_customer_id,
    'CREATE_DRAFT', null, 'WITHDRAWAL_DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null
  );

  return jsonb_build_object(
    'id', v_request_id,
    'withdrawal_no', v_withdrawal_no,
    'customer_id', v_target_customer_id,
    'status', 'WITHDRAWAL_DRAFT',
    'action', 'CREATE_DRAFT'
  );
end;
$$;

-- 3. Replace update RPC — drop old overload then recreate with new param
drop function if exists public.tgd_update_customer_withdrawal_request_draft(uuid, date, text, text, text, text);

create or replace function public.tgd_update_customer_withdrawal_request_draft(
  p_request_id uuid,
  p_requested_dispatch_date date,
  p_delivery_type text,
  p_pickup_contact text,
  p_destination text,
  p_note text default null,
  p_vehicle_registration text default null
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

  select w.id, w.customer_id, w.status, w.withdrawal_no
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
      vehicle_registration = nullif(btrim(p_vehicle_registration), ''),
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
    'withdrawal_no', v_document.withdrawal_no,
    'customer_id', v_document.customer_id,
    'status', v_document.status,
    'action', 'UPDATE_DRAFT'
  );
end;
$$;

-- 4. Grants
revoke all on function public.tgd_create_customer_withdrawal_request(date, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.tgd_create_customer_withdrawal_request(date, text, text, text, text, uuid, text) to authenticated;

revoke all on function public.tgd_update_customer_withdrawal_request_draft(uuid, date, text, text, text, text, text) from public, anon;
grant execute on function public.tgd_update_customer_withdrawal_request_draft(uuid, date, text, text, text, text, text) to authenticated;

commit;
