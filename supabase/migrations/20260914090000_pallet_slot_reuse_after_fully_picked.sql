-- Lets a pallet slot be reused once whatever was on it before has been
-- fully picked out -- confirmed real gap: pallet 3 at 42-R-21 held tracking
-- FR260904025 (27 boxes), which was picked out to exactly 0 remaining, yet
-- staff could not store anything new on pallet 3 there. The handheld/desktop
-- "add storage" UI already treats a fully-picked allocation as a free slot
-- (getPalletDetailsAtLocation/resolvePalletSlotState in
-- src/services/warehouseLayoutService.js filter it out of the "occupied"
-- list), so the pallet-number dropdown correctly offered 3 as available --
-- but tgd_add_deposit_line_location_allocation's own collision check (and
-- the table's hard UNIQUE(location_id, pallet_no) constraint underneath it)
-- blocked it anyway, since that allocation ROW still physically exists even
-- though it no longer holds any stock. Fixes the mismatch by:
--   1. Dropping the permanent unique constraint (a pallet slot's history can
--      now have more than one allocation row over time, same physical spot,
--      different tracking codes across different periods).
--   2. Rewriting the RPC's collision check to match the UI's own definition
--      of "occupied": only an allocation that STILL has remaining (unpicked)
--      boxes blocks reuse of that slot -- a fully-vacated one no longer does.
--   3. Locking the target location row (for update) while checking, so two
--      concurrent adds to the same just-vacated slot can't both slip past
--      the check (mirrors the existing for-update lock already taken on the
--      deposit line a few lines below).

begin;

alter table public.tgd_customer_deposit_line_locations
  drop constraint if exists tgd_customer_deposit_line_locations_location_id_pallet_no_key;

create or replace function public.tgd_add_deposit_line_location_allocation(
  p_line_id uuid,
  p_location_id uuid,
  p_pallet_no integer,
  p_boxes numeric default null,
  p_weight numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_line record;
  v_capacity integer;
  v_existing_boxes numeric;
  v_existing_weight numeric;
  v_allocation_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse or admin role required to store a pallet allocation';
  end if;

  select id, actual_boxes, actual_weight
  into v_line
  from public.tgd_customer_deposit_request_lines
  where id = p_line_id
  for update;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  select capacity into v_capacity from public.tgd_locations where id = p_location_id for update;
  if not found then
    raise exception 'Location not found';
  end if;
  if v_capacity is not null and (p_pallet_no < 1 or p_pallet_no > v_capacity) then
    raise exception 'Pallet number % is out of range for this location (capacity %)', p_pallet_no, v_capacity;
  end if;

  -- Only an allocation that STILL has stock on it blocks reuse of this
  -- pallet slot -- one already picked down to nothing (or exactly zero
  -- boxes recorded) no longer occupies it. boxes is null (a weight-only
  -- receipt with no box count) is conservatively always treated as active,
  -- same convention as getSectionsWithOccupancy's own occupancy math.
  if exists (
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
  ) then
    raise exception 'Pallet % at this location still has stock on it -- pick it out first', p_pallet_no;
  end if;

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

  insert into public.tgd_customer_deposit_line_locations (line_id, location_id, pallet_no, boxes, weight, created_by_email)
  values (p_line_id, p_location_id, p_pallet_no, p_boxes, p_weight, v_profile.email)
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
    'weight', p_weight
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
