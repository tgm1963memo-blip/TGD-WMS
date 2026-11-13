-- Lets TGC staff correct the vehicle registration (ทะเบียนรถ) on a customer
-- deposit or withdrawal when the truck that actually turns up isn't the one
-- the customer declared.
--
-- The plate the customer declared is the one printed on their ร.3 movement
-- permit, so the first staff edit snapshots it into declared_vehicle_registration
-- (never overwritten afterwards). The UI compares the current plate against
-- that snapshot and warns when a ร.3 document is involved and they no longer
-- match. It only warns; it never blocks.
--
-- Same shape as tgd_set_withdrawal_r3_document (20261105110000): staff-only,
-- configurable through tgd_role_function_allowed, audited on the header and
-- in the document timeline (action SET_VEHICLE_REGISTRATION).

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists declared_vehicle_registration text,
  add column if not exists vehicle_registration_set_by_email text,
  add column if not exists vehicle_registration_set_at timestamptz;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists declared_vehicle_registration text,
  add column if not exists vehicle_registration_set_by_email text,
  add column if not exists vehicle_registration_set_at timestamptz;

create or replace function public.tgd_set_deposit_vehicle_registration(
  p_request_id uuid,
  p_vehicle_registration text,
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
  v_value text := nullif(btrim(coalesce(p_vehicle_registration, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_declared text;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if not public.tgd_role_function_allowed(
    v_profile.role, 'customer_deposit_set_vehicle_registration',
    v_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to change the vehicle registration';
  end if;

  select d.id, d.customer_id, d.status, d.vehicle_registration, d.declared_vehicle_registration,
         d.vehicle_registration_set_at
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED', 'REJECTED') then
    raise exception 'Cannot change the vehicle registration on a cancelled/rejected request';
  end if;

  -- Snapshot the customer's declared plate (the ร.3 plate) on the first edit only
  -- (vehicle_registration_set_at is null). A blank declared plate stays blank,
  -- so a later staff edit is never mistaken for the ร.3 plate.
  v_declared := case
    when v_document.vehicle_registration_set_at is null then v_document.vehicle_registration
    else v_document.declared_vehicle_registration
  end;

  update public.tgd_customer_deposit_requests
  set vehicle_registration = v_value,
      declared_vehicle_registration = v_declared,
      vehicle_registration_set_by_email = v_profile.email,
      vehicle_registration_set_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SET_VEHICLE_REGISTRATION', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, null,
    coalesce(v_note, 'แก้ไขทะเบียนรถ'),
    jsonb_build_object(
      'previous', coalesce(v_document.vehicle_registration, '-'),
      'vehicle_registration', coalesce(v_value, '-'),
      'declared', coalesce(v_declared, '-')
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'vehicle_registration', v_value,
    'declared_vehicle_registration', v_declared,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

create or replace function public.tgd_set_withdrawal_vehicle_registration(
  p_request_id uuid,
  p_vehicle_registration text,
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
  v_value text := nullif(btrim(coalesce(p_vehicle_registration, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_declared text;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if not public.tgd_role_function_allowed(
    v_profile.role, 'customer_withdrawal_set_vehicle_registration',
    v_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to change the vehicle registration';
  end if;

  select w.id, w.customer_id, w.status, w.vehicle_registration, w.declared_vehicle_registration,
         w.vehicle_registration_set_at
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED', 'REJECTED') then
    raise exception 'Cannot change the vehicle registration on a cancelled/rejected request';
  end if;

  v_declared := case
    when v_document.vehicle_registration_set_at is null then v_document.vehicle_registration
    else v_document.declared_vehicle_registration
  end;

  update public.tgd_customer_withdrawal_requests
  set vehicle_registration = v_value,
      declared_vehicle_registration = v_declared,
      vehicle_registration_set_by_email = v_profile.email,
      vehicle_registration_set_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SET_VEHICLE_REGISTRATION', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, null,
    coalesce(v_note, 'แก้ไขทะเบียนรถ'),
    jsonb_build_object(
      'previous', coalesce(v_document.vehicle_registration, '-'),
      'vehicle_registration', coalesce(v_value, '-'),
      'declared', coalesce(v_declared, '-')
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'vehicle_registration', v_value,
    'declared_vehicle_registration', v_declared,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_deposit_vehicle_registration(uuid, text, text) from public, anon;
grant execute on function public.tgd_set_deposit_vehicle_registration(uuid, text, text) to authenticated;
revoke all on function public.tgd_set_withdrawal_vehicle_registration(uuid, text, text) from public, anon;
grant execute on function public.tgd_set_withdrawal_vehicle_registration(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
