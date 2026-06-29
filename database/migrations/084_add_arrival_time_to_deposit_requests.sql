-- Migration 084: Add arrival_time field to customer deposit requests
-- Allows customers to record the expected vehicle arrival time (HH:MM)

begin;

-- 1. Add column
alter table public.tgd_customer_deposit_requests
  add column if not exists arrival_time text;

-- 2. Drop old function signatures so we can recreate with the new parameter
drop function if exists public.tgd_create_customer_deposit_request(date, text, text, text, uuid, text);
drop function if exists public.tgd_update_customer_deposit_request_draft(uuid, date, text, text, text, text);
drop function if exists public.tgd_update_customer_deposit_request_draft(uuid, date, text, text, text);

-- 3. Recreate create function with p_arrival_time
create or replace function public.tgd_create_customer_deposit_request(
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null,
  p_customer_id uuid default null,
  p_vehicle_registration text default null,
  p_arrival_time text default null
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
  v_request_no text;
  v_request_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then raise exception 'Active profile required'; end if;

  v_target_customer_id := public.tgd_resolve_customer_request_target_id(
    v_profile.role, v_profile.customer_id, p_customer_id
  );

  perform pg_advisory_xact_lock(hashtext('cdr:' || v_target_customer_id::text || ':' || v_day));

  select coalesce(max(nullif(regexp_replace(d.request_no, '^CDR-' || v_day || '-', ''), '')::integer), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_requests d
  where d.request_no like 'CDR-' || v_day || '-%';

  v_request_no := format('CDR-%s-%s', v_day, lpad(v_seq::text, 4, '0'));

  insert into public.tgd_customer_deposit_requests (
    request_no, customer_id, status,
    expected_arrival_date, contact_name, contact_phone, note,
    vehicle_registration, arrival_time,
    created_by_user_id, created_by_email, created_by_display_name, created_by_role,
    last_action_by_user_id, last_action_by_email, last_action_at
  ) values (
    v_request_no, v_target_customer_id, 'DRAFT',
    p_expected_arrival_date,
    nullif(btrim(p_contact_name), ''),
    nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_note), ''),
    nullif(btrim(p_vehicle_registration), ''),
    nullif(btrim(p_arrival_time), ''),
    v_profile.id, v_profile.email, null, v_profile.role,
    v_profile.id, v_profile.email, now()
  )
  returning id into v_request_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_request_id, v_target_customer_id,
    'CREATE_DRAFT', null, 'DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id, null
  );

  return jsonb_build_object(
    'id', v_request_id, 'request_no', v_request_no,
    'customer_id', v_target_customer_id, 'status', 'DRAFT', 'action', 'CREATE_DRAFT'
  );
end;
$$;

-- 4. Recreate update function with p_arrival_time and p_vehicle_registration
create or replace function public.tgd_update_customer_deposit_request_draft(
  p_request_id uuid,
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null,
  p_vehicle_registration text default null,
  p_arrival_time text default null
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
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then raise exception 'Active profile required'; end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then raise exception 'Customer deposit request not found'; end if;

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
      vehicle_registration = nullif(btrim(p_vehicle_registration), ''),
      arrival_time = nullif(btrim(p_arrival_time), ''),
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
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id, null
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_document.status,
    'action', 'UPDATE_DRAFT'
  );
end;
$$;

grant execute on function public.tgd_create_customer_deposit_request(date, text, text, text, uuid, text, text) to authenticated;
grant execute on function public.tgd_update_customer_deposit_request_draft(uuid, date, text, text, text, text, text) to authenticated;

commit;
