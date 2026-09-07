-- Collapses the 5-segment location code {room}-{side}-{row}-{level}-{bay}
-- (e.g. "42-L-01-01-01") down to 3 segments {room}-{side}-{row} -- level
-- ("ชั้น") and bay ("ตอน") are dropped as a distinct identity dimension.
-- The physical reality: one row genuinely holds 12-16 pallets loosely, not
-- fixed level/bay slots -- the old scheme created 12 separate location rows
-- per row (1,344 total across the 2 live rooms) instead of one row-level
-- location with a pallet count.
--
-- Confirmed via a dry run against production before writing this:
--   - 1,344 total locations / 112 distinct (room, side, row) groups = 12
--     level*bay combinations per row uniformly (clean, no ragged groups).
--   - Every one of the 112 groups has a level=01,bay=01 location to use as
--     the surviving row-level record.
--   - Of the 1,232 non-surviving locations that will be deleted, only 3
--     rows anywhere reference one via FK (all in
--     tgd_customer_deposit_request_lines) -- tgd_stock_balances,
--     tgd_pallets, tgd_adjustment_lines, tgd_putaway_tasks,
--     tgd_receiving_lines, tgd_stock_count_lines, tgd_transfer_lines all
--     had zero rows referencing a non-survivor. Still remapped all 9 FK
--     columns across all 8 tables defensively, not just the ones with
--     rows today.
--
-- Also fixes a latent mismatch: a location's OLD location_code embeds
-- whatever room number existed when it was generated. An earlier same-day
-- change renamed room 43's zone_code/zone_name display label to "42"
-- (display-only, by explicit user choice, since renumbering the 672
-- embedded location codes for that room too was a much larger separate
-- decision at the time) -- so building the new 3-segment code from the
-- CURRENT zone_code/zone_name (via a live join), not by reusing the old
-- code's own first segment, makes every location's code finally agree
-- with its room's current display name instead of baking the mismatch
-- into the new format too.

begin;

alter table public.tgd_locations add column if not exists capacity integer;

create temporary table location_migration_map (
  old_id uuid primary key,
  new_id uuid not null
) on commit drop;

with parsed as (
  select
    l.id,
    l.room_id,
    z.id as zone_id,
    z.zone_code,
    z.zone_name,
    split_part(l.location_code, '-', 2) as side,
    split_part(l.location_code, '-', 3) as row_seg,
    split_part(l.location_code, '-', 4) as level_seg,
    split_part(l.location_code, '-', 5) as bay_seg
  from public.tgd_locations l
  join public.tgd_rooms r on r.id = l.room_id
  join public.tgd_zones z on z.id = r.zone_id
  where l.location_code ~ '^.+-[LR]-\d+-\d+(-\d+)?$'
),
survivors as (
  select distinct on (room_id, side, row_seg) id, room_id, side, row_seg
  from parsed
  where level_seg = '01' and (bay_seg = '01' or bay_seg = '')
  order by room_id, side, row_seg, id
)
insert into location_migration_map (old_id, new_id)
select p.id, s.id
from parsed p
join survivors s on s.room_id = p.room_id and s.side = p.side and s.row_seg = p.row_seg
where p.id <> s.id;

-- Remap every FK column found (live, via information_schema) pointing at
-- tgd_locations(id) before deleting the non-survivor rows.
update public.tgd_customer_deposit_request_lines t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_stock_balances t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_pallets t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_adjustment_lines t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_putaway_tasks t set target_location_id = m.new_id
  from location_migration_map m where t.target_location_id = m.old_id;
update public.tgd_receiving_lines t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_stock_count_lines t set location_id = m.new_id
  from location_migration_map m where t.location_id = m.old_id;
update public.tgd_transfer_lines t set to_location_id = m.new_id
  from location_migration_map m where t.to_location_id = m.old_id;
update public.tgd_transfer_lines t set from_location_id = m.new_id
  from location_migration_map m where t.from_location_id = m.old_id;

delete from public.tgd_locations where id in (select old_id from location_migration_map);

-- Rename every surviving location to the 3-segment code + capacity, using
-- the room's CURRENT zone_code/zone_name (see header comment).
update public.tgd_locations l
set
  location_code = z.zone_code || '-' || split_part(l.location_code, '-', 2) || '-' || split_part(l.location_code, '-', 3),
  location_name = z.zone_name || ' ฝั่ง' || (case split_part(l.location_code, '-', 2) when 'L' then 'ซ้าย' when 'R' then 'ขวา' else split_part(l.location_code, '-', 2) end)
    || ' แถว' || (split_part(l.location_code, '-', 3))::int,
  capacity = coalesce(l.capacity, 14)
from public.tgd_rooms r, public.tgd_zones z
where l.room_id = r.id and r.zone_id = z.id
  and l.location_code ~ '^.+-[LR]-\d+-\d+(-\d+)?$';

commit;
