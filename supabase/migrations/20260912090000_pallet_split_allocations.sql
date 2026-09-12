-- Splits a single deposit line (one tracking code) across multiple
-- physical pallets, each within a location row's existing capacity, and
-- lets withdrawal picks reference exactly which pallet they came from.
--
-- Deliberately does NOT touch tgd_locations at all -- a location row still
-- represents one physical warehouse row (see 20260905090000, which
-- collapsed level/bay into that single row-per-record model on purpose).
-- "Pallet number" here is an attribute of the ALLOCATION of a line's stock
-- to a row, not a new location record -- {room}-{side}-{row}-{palletNo} is
-- assembled for display only (see locationCodeUtils.buildPalletCode),
-- never stored as a location_code.
--
-- tgd_customer_deposit_request_lines.location_id is kept (not dropped) as
-- a denormalized "most recently added" pointer for any old code path that
-- still reads it directly, but it is no longer the source of truth for
-- occupancy/reporting once a line has allocation rows -- those now live in
-- tgd_customer_deposit_line_locations below.

begin;

create table public.tgd_customer_deposit_line_locations (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.tgd_customer_deposit_request_lines(id) on delete cascade,
  location_id uuid not null references public.tgd_locations(id),
  pallet_no integer not null check (pallet_no > 0),
  boxes numeric,
  weight numeric,
  created_at timestamptz not null default now(),
  created_by_email text,
  unique (location_id, pallet_no)
);

create index tgd_customer_deposit_line_locations_line_id_idx
  on public.tgd_customer_deposit_line_locations(line_id);

comment on table public.tgd_customer_deposit_line_locations is
  'One row per pallet a deposit line''s stock was placed on. A line with N rows here is split across N pallets; pallet_no is scoped to (location_id), i.e. it identifies a slot within that location''s row, capped at tgd_locations.capacity.';

create table public.tgd_customer_withdrawal_line_pallet_picks (
  id uuid primary key default gen_random_uuid(),
  withdrawal_line_id uuid not null references public.tgd_customer_withdrawal_request_lines(id) on delete cascade,
  deposit_line_location_id uuid not null references public.tgd_customer_deposit_line_locations(id),
  boxes numeric,
  weight numeric,
  picked_at timestamptz not null default now(),
  picked_by_email text
);

create index tgd_customer_withdrawal_line_pallet_picks_withdrawal_line_id_idx
  on public.tgd_customer_withdrawal_line_pallet_picks(withdrawal_line_id);
create index tgd_customer_withdrawal_line_pallet_picks_deposit_line_location_id_idx
  on public.tgd_customer_withdrawal_line_pallet_picks(deposit_line_location_id);

comment on table public.tgd_customer_withdrawal_line_pallet_picks is
  'One row per pick against a specific pallet allocation -- lets one withdrawal line''s pick be sourced from more than one pallet, and records exactly which pallet(s) stock physically came from.';

alter table public.tgd_customer_products
  add column if not exists default_boxes_per_pallet integer;

comment on column public.tgd_customer_products.default_boxes_per_pallet is
  'Default quantity (boxes) of this product that fits on one pallet -- used only to prefill the suggested split quantity when storing/picking a large tracking-code quantity across multiple pallets. Nullable; null means no suggestion, staff enters the amount manually.';

-- RLS: mirror the existing read-scoping pattern (role + customer scope) on
-- the parent lines -- both new tables are written exclusively through the
-- SECURITY DEFINER RPCs below (which bypass RLS as their own definer), so
-- only a SELECT policy is needed, same as tgd_customer_deposit_request_lines
-- and tgd_customer_withdrawal_request_lines already have.
alter table public.tgd_customer_deposit_line_locations enable row level security;
alter table public.tgd_customer_withdrawal_line_pallet_picks enable row level security;

create policy rls_customer_deposit_line_locations_select
  on public.tgd_customer_deposit_line_locations
  for select to authenticated
  using (
    exists (
      select 1
      from public.tgd_customer_deposit_request_lines l
      join public.tgd_customer_deposit_requests d on d.id = l.deposit_request_id
      where l.id = tgd_customer_deposit_line_locations.line_id
        and tgd_current_user_is_active()
        and (
          (tgd_current_user_role() = any (array['admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'])
            and (tgd_current_user_role_customer_scope() is null or tgd_current_user_role_customer_scope() = d.customer_id))
          or (tgd_current_user_role() = any (array['customer_admin', 'customer_user'])
            and tgd_current_user_customer_id() = d.customer_id)
        )
    )
  );

create policy rls_customer_withdrawal_line_pallet_picks_select
  on public.tgd_customer_withdrawal_line_pallet_picks
  for select to authenticated
  using (
    exists (
      select 1
      from public.tgd_customer_withdrawal_request_lines wl
      join public.tgd_customer_withdrawal_requests w on w.id = wl.withdrawal_request_id
      where wl.id = tgd_customer_withdrawal_line_pallet_picks.withdrawal_line_id
        and tgd_current_user_is_active()
        and (
          (tgd_current_user_role() = any (array['admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'])
            and (tgd_current_user_role_customer_scope() is null or tgd_current_user_role_customer_scope() = w.customer_id))
          or (tgd_current_user_role() = any (array['customer_admin', 'customer_user'])
            and tgd_current_user_customer_id() = w.customer_id)
        )
    )
  );

-- Backfill: every deposit line that already has a location_id gets exactly
-- one allocation row so old tracking codes work identically to new ones
-- under the new model -- staff can open any old line's "ระบุ Location",
-- cancel that one allocation, and re-split it across pallets the same way
-- they would a brand-new receipt.
--
-- pallet_no can't just be 1 for every row: the earlier row-consolidation
-- migration (20260905090000) merged many old level/bay locations into one
-- row-level record, so several deposit lines legitimately already share
-- the same location_id today -- row_number() assigns each of them the
-- next free pallet slot at that location instead of colliding on
-- (location_id, 1). A location whose real line count already exceeds its
-- nominal capacity ends up with pallet_no values past that capacity here,
-- which is fine: capacity has only ever been a soft/advisory number (never
-- hard-enforced), so backfilled legacy data is allowed to reflect reality
-- rather than being truncated.
insert into public.tgd_customer_deposit_line_locations (line_id, location_id, pallet_no, boxes, weight)
select l.id, l.location_id,
       row_number() over (partition by l.location_id order by l.created_at, l.id),
       l.actual_boxes, l.actual_weight
from public.tgd_customer_deposit_request_lines l
where l.location_id is not null;

-- Backfill: every withdrawal line that already has a pick recorded gets
-- one pick row pointed at the deposit line's backfilled allocation above
-- (matched by source line id, else tracking code -- same fallback the
-- live RPCs already use). A withdrawal line whose source can't be resolved
-- this way (e.g. the deposit line itself has no location_id, or was
-- deleted) is left without a pick row -- its aggregate picked_boxes/
-- picked_weight on tgd_customer_withdrawal_request_lines is untouched, so
-- existing reports/behavior for it don't regress, it just won't show
-- pallet-level detail until re-picked under the new flow.
insert into public.tgd_customer_withdrawal_line_pallet_picks (withdrawal_line_id, deposit_line_location_id, boxes, weight, picked_at, picked_by_email)
select wl.id, dll.id, wl.picked_boxes, wl.picked_weight, coalesce(wl.picked_at, now()), wl.picked_by_email
from public.tgd_customer_withdrawal_request_lines wl
join public.tgd_customer_deposit_request_lines dl
  on dl.id = wl.source_customer_deposit_request_line_id
  or (wl.source_customer_deposit_request_line_id is null and wl.tracking_code is not null and dl.tracking_code = wl.tracking_code)
join public.tgd_customer_deposit_line_locations dll on dll.line_id = dl.id
where wl.picked_boxes is not null or wl.picked_weight is not null;

-- Adds one pallet allocation to a deposit line. Safe to call repeatedly
-- for the same line (that's the whole point -- "add storage one pallet at
-- a time" until the line's full quantity is placed); the running total
-- across all of a line's allocations is enforced not to exceed what was
-- actually received.
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

  select capacity into v_capacity from public.tgd_locations where id = p_location_id;
  if not found then
    raise exception 'Location not found';
  end if;
  if v_capacity is not null and (p_pallet_no < 1 or p_pallet_no > v_capacity) then
    raise exception 'Pallet number % is out of range for this location (capacity %)', p_pallet_no, v_capacity;
  end if;

  if exists (
    select 1 from public.tgd_customer_deposit_line_locations
    where location_id = p_location_id and pallet_no = p_pallet_no
  ) then
    raise exception 'Pallet % at this location is already in use', p_pallet_no;
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

-- Cancels one pallet allocation, returning its quantity to the line's
-- unallocated remainder. Blocked if a withdrawal has already picked from
-- it -- that pick has to be undone first (tgd_remove_withdrawal_line_
-- pallet_pick), since otherwise the pick would be left pointing at a
-- pallet the deposit side no longer claims to hold anything on.
create or replace function public.tgd_remove_deposit_line_location_allocation(
  p_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_allocation record;
  v_next_location_id uuid;
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
    raise exception 'Warehouse or admin role required to cancel a pallet allocation';
  end if;

  select id, line_id, location_id
  into v_allocation
  from public.tgd_customer_deposit_line_locations
  where id = p_allocation_id
  for update;

  if not found then
    raise exception 'Pallet allocation not found';
  end if;

  if exists (
    select 1 from public.tgd_customer_withdrawal_line_pallet_picks
    where deposit_line_location_id = p_allocation_id
  ) then
    raise exception 'Cannot cancel: stock has already been picked from this pallet -- undo that pick first';
  end if;

  delete from public.tgd_customer_deposit_line_locations where id = p_allocation_id;

  select location_id into v_next_location_id
  from public.tgd_customer_deposit_line_locations
  where line_id = v_allocation.line_id
  order by created_at desc
  limit 1;

  update public.tgd_customer_deposit_request_lines
  set location_id = v_next_location_id
  where id = v_allocation.line_id;

  return jsonb_build_object('id', p_allocation_id, 'line_id', v_allocation.line_id);
end;
$$;

-- Records a pick against one specific pallet allocation. Unlike the older
-- tgd_record_withdrawal_line_pick (which sets picked_boxes/picked_weight
-- to an absolute total in one call), this is additive by design: a
-- withdrawal line can be picked from more than one pallet, one pick per
-- call, and the line's aggregate picked_boxes/picked_weight is recomputed
-- as the sum of all its pallet picks so existing reports/screens that
-- read those two columns keep working unchanged.
create or replace function public.tgd_record_withdrawal_line_pallet_pick(
  p_withdrawal_line_id uuid,
  p_deposit_line_location_id uuid,
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
  v_allocation record;
  v_picked_boxes numeric;
  v_picked_weight numeric;
  v_total_boxes numeric;
  v_total_weight numeric;
  v_pick_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if not exists (select 1 from public.tgd_customer_withdrawal_request_lines where id = p_withdrawal_line_id) then
    raise exception 'Withdrawal request line not found';
  end if;

  select id, boxes, weight
  into v_allocation
  from public.tgd_customer_deposit_line_locations
  where id = p_deposit_line_location_id
  for update;

  if not found then
    raise exception 'Pallet allocation not found';
  end if;

  select coalesce(sum(boxes), 0), coalesce(sum(weight), 0)
  into v_picked_boxes, v_picked_weight
  from public.tgd_customer_withdrawal_line_pallet_picks
  where deposit_line_location_id = p_deposit_line_location_id;

  if v_allocation.boxes is not null and p_boxes is not null
     and (v_picked_boxes + p_boxes) > v_allocation.boxes then
    raise exception 'Boxes to pick (%) exceed what remains on this pallet (%)',
      p_boxes, greatest(0, v_allocation.boxes - v_picked_boxes);
  end if;

  if v_allocation.weight is not null and p_weight is not null
     and (v_picked_weight + p_weight) > v_allocation.weight then
    raise exception 'Weight to pick (%) exceeds what remains on this pallet (%)',
      p_weight, greatest(0, v_allocation.weight - v_picked_weight);
  end if;

  insert into public.tgd_customer_withdrawal_line_pallet_picks
    (withdrawal_line_id, deposit_line_location_id, boxes, weight, picked_by_email)
  values (p_withdrawal_line_id, p_deposit_line_location_id, p_boxes, p_weight, v_profile.email)
  returning id into v_pick_id;

  select coalesce(sum(boxes), 0), coalesce(sum(weight), 0)
  into v_total_boxes, v_total_weight
  from public.tgd_customer_withdrawal_line_pallet_picks
  where withdrawal_line_id = p_withdrawal_line_id;

  update public.tgd_customer_withdrawal_request_lines
  set picked_boxes = v_total_boxes,
      picked_weight = v_total_weight,
      picked_at = now(),
      picked_by_email = v_profile.email
  where id = p_withdrawal_line_id;

  return jsonb_build_object(
    'id', v_pick_id,
    'withdrawal_line_id', p_withdrawal_line_id,
    'deposit_line_location_id', p_deposit_line_location_id,
    'boxes', p_boxes,
    'weight', p_weight,
    'line_total_picked_boxes', v_total_boxes,
    'line_total_picked_weight', v_total_weight
  );
end;
$$;

-- Undoes one pallet pick, returning its quantity to that pallet's
-- available balance and recomputing the withdrawal line's aggregate
-- picked_boxes/picked_weight from whatever pick rows remain.
create or replace function public.tgd_remove_withdrawal_line_pallet_pick(
  p_pick_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_pick record;
  v_total_boxes numeric;
  v_total_weight numeric;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  select id, withdrawal_line_id
  into v_pick
  from public.tgd_customer_withdrawal_line_pallet_picks
  where id = p_pick_id
  for update;

  if not found then
    raise exception 'Pick not found';
  end if;

  delete from public.tgd_customer_withdrawal_line_pallet_picks where id = p_pick_id;

  select coalesce(sum(boxes), 0), coalesce(sum(weight), 0)
  into v_total_boxes, v_total_weight
  from public.tgd_customer_withdrawal_line_pallet_picks
  where withdrawal_line_id = v_pick.withdrawal_line_id;

  update public.tgd_customer_withdrawal_request_lines
  set picked_boxes = nullif(v_total_boxes, 0),
      picked_weight = nullif(v_total_weight, 0)
  where id = v_pick.withdrawal_line_id;

  return jsonb_build_object('id', p_pick_id, 'withdrawal_line_id', v_pick.withdrawal_line_id);
end;
$$;

notify pgrst, 'reload schema';

commit;
