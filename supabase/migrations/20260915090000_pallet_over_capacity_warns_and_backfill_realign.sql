-- Two related fixes, per explicit request:
--
-- 1. A pallet number beyond a location's configured capacity is now a
--    non-blocking WARNING (pallet_over_capacity in the RPC's result),
--    matching the same pattern already used for a duplicate pallet number
--    (pallet_already_in_use) -- staff can type in a higher pallet number
--    themselves when a row genuinely needs more than its configured
--    capacity, rather than being hard-blocked. Only p_pallet_no < 1 stays
--    a hard error (not a real pallet number at all).
--
-- 2. Backfills capacity up to the REAL distinct active-pallet count for any
--    location where that count already exceeds its configured capacity --
--    confirmed real gap: several rows (e.g. 42-L-14 with 23 genuinely
--    distinct pallets, 42-R-14 with 17) were backfilled by the original
--    pre-pallet-split migration (20260912090000) with pallet numbers well
--    past the blanket capacity=12 every row was set up with, since that
--    backfill used row_number() with no capacity cap at all. This was
--    already-accepted "soft capacity" data, not a bug -- but the dashboard
--    showing e.g. "23/12" reads as broken even though it's accurate, so
--    capacity now reflects reality for these specific rows instead of
--    displaying over 100% forever. Rows within their configured capacity
--    are untouched.

begin;

update public.tgd_locations l
set capacity = sub.real_count
from (
  select a.location_id, count(distinct a.pallet_no) as real_count
  from public.tgd_customer_deposit_line_locations a
  where (
    a.boxes is null
    or a.boxes > coalesce((
      select sum(pk.boxes) from public.tgd_customer_withdrawal_line_pallet_picks pk
      where pk.deposit_line_location_id = a.id
    ), 0)
  )
  group by a.location_id
) sub
where sub.location_id = l.id
  and (l.capacity is null or sub.real_count > l.capacity);

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
  v_pallet_already_active boolean;
  v_pallet_over_capacity boolean;
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
    'weight', p_weight,
    'pallet_already_in_use', v_pallet_already_active,
    'pallet_over_capacity', v_pallet_over_capacity
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
