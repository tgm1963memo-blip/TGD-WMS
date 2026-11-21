-- Offline handheld sync can send the same allocation twice: the connection
-- drops after the server commits but before the phone hears back, and the
-- queue retries. A duplicate pallet is only a warning here, so the retry used
-- to double the allocation. p_client_action_id makes a resend return the
-- first result instead of inserting again.
--
-- p_actor_profile_id credits the staff member picked on the handheld, because
-- the device session is shared. Same rule as tgd_set_deposit_receiving_time.
--
-- Both parameters default to null, so app versions still cached on phones
-- keep working. Apply this before deploying the app that sends them.

alter table public.tgd_customer_deposit_line_locations
  add column if not exists client_action_id uuid;

create unique index if not exists tgd_customer_deposit_line_locations_client_action_id_key
  on public.tgd_customer_deposit_line_locations(client_action_id)
  where client_action_id is not null;

comment on column public.tgd_customer_deposit_line_locations.client_action_id is
  'Set by the offline queue so a resend of the same action is recognised instead of inserted again.';

drop function if exists public.tgd_add_deposit_line_location_allocation(uuid, uuid, integer, numeric, numeric);

create function public.tgd_add_deposit_line_location_allocation(
  p_line_id uuid,
  p_location_id uuid,
  p_pallet_no integer,
  p_boxes numeric default null,
  p_weight numeric default null,
  p_client_action_id uuid default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_allowed_roles text[] := array['admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff'];
  v_session_profile record;
  v_profile record;
  v_line record;
  v_existing record;
  v_capacity integer;
  v_existing_boxes numeric;
  v_existing_weight numeric;
  v_allocation_id uuid;
  v_pallet_already_active boolean;
  v_pallet_over_capacity boolean;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_session_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_session_profile.role <> all(v_allowed_roles) then
    raise exception 'Warehouse or admin role required to store a pallet allocation';
  end if;

  v_profile := v_session_profile;
  if p_actor_profile_id is not null then
    select p.id, p.email, p.role into v_profile
    from public.tgd_user_profiles p
    where p.id = p_actor_profile_id
      and p.is_active = true
      and p.role = any(v_allowed_roles)
    limit 1;
    if not found then
      v_profile := v_session_profile;
    end if;
  end if;

  select id, actual_boxes, actual_weight
  into v_line
  from public.tgd_customer_deposit_request_lines
  where id = p_line_id
  for update;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  -- After the line lock, so two copies of one send arriving together queue up
  -- here and the second finds the first. Ahead of the quantity checks, which
  -- a resend would otherwise fail because its own boxes are already counted.
  if p_client_action_id is not null then
    select a.id, a.line_id, a.location_id, a.pallet_no, a.boxes, a.weight
    into v_existing
    from public.tgd_customer_deposit_line_locations a
    where a.client_action_id = p_client_action_id;

    if found then
      return jsonb_build_object(
        'id', v_existing.id,
        'line_id', v_existing.line_id,
        'location_id', v_existing.location_id,
        'pallet_no', v_existing.pallet_no,
        'boxes', v_existing.boxes,
        'weight', v_existing.weight,
        'pallet_already_in_use', false,
        'pallet_over_capacity', false,
        'already_applied', true
      );
    end if;
  end if;

  if p_pallet_no < 1 then
    raise exception 'Pallet number must be 1 or greater';
  end if;

  select capacity into v_capacity from public.tgd_locations where id = p_location_id for update;
  if not found then
    raise exception 'Location not found';
  end if;

  -- Informational only -- a pallet number past the row's configured
  -- capacity, or one that already has other active stock on it, both just
  -- get reported back rather than blocking the save. Staff can genuinely
  -- need to place more pallets than a row's nominal capacity suggests.
  v_pallet_over_capacity := v_capacity is not null and p_pallet_no > v_capacity;

  select exists (
    select 1
    from public.tgd_customer_deposit_line_locations a
    where a.location_id = p_location_id
      and a.pallet_no = p_pallet_no
      and (
        a.boxes is null
        or a.boxes > coalesce((
          select sum(pk.boxes) from public.tgd_customer_withdrawal_line_pallet_picks pk
          where pk.deposit_line_location_id = a.id
        ), 0)
      )
  ) into v_pallet_already_active;

  select coalesce(sum(boxes), 0), coalesce(sum(weight), 0)
  into v_existing_boxes, v_existing_weight
  from public.tgd_customer_deposit_line_locations
  where line_id = p_line_id;

  if v_line.actual_boxes is not null and p_boxes is not null
     and (v_existing_boxes + p_boxes) > v_line.actual_boxes then
    raise exception 'Boxes to store (%) would exceed remaining unallocated quantity (%)',
      p_boxes, greatest(0, v_line.actual_boxes - v_existing_boxes);
  end if;

  if v_line.actual_weight is not null and p_weight is not null
     and (v_existing_weight + p_weight) > v_line.actual_weight then
    raise exception 'Weight to store (%) would exceed remaining unallocated quantity (%)',
      p_weight, greatest(0, v_line.actual_weight - v_existing_weight);
  end if;

  insert into public.tgd_customer_deposit_line_locations (line_id, location_id, pallet_no, boxes, weight, created_by_email, client_action_id)
  values (p_line_id, p_location_id, p_pallet_no, p_boxes, p_weight, v_profile.email, p_client_action_id)
  returning id into v_allocation_id;

  update public.tgd_customer_deposit_request_lines
  set location_id = p_location_id
  where id = p_line_id;

  return jsonb_build_object(
    'id', v_allocation_id,
    'line_id', p_line_id,
    'location_id', p_location_id,
    'pallet_no', p_pallet_no,
    'boxes', p_boxes,
    'weight', p_weight,
    'pallet_already_in_use', v_pallet_already_active,
    'pallet_over_capacity', v_pallet_over_capacity
  );
end;
$$;

revoke all on function public.tgd_add_deposit_line_location_allocation(uuid, uuid, integer, numeric, numeric, uuid, uuid) from public;
grant execute on function public.tgd_add_deposit_line_location_allocation(uuid, uuid, integer, numeric, numeric, uuid, uuid) to authenticated, service_role;
