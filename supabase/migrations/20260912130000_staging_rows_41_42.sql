-- Adds the "รอจ่าย" (awaiting-dispatch) staging row -- row 0, see
-- locationCodeUtils.js's formatRowLabel -- to both existing cold rooms (41
-- and 42), both sides (L/R), per explicit request. Same shape/capacity as
-- every other row in that room; no unique constraint on location_code
-- exists (see tgd_locations' constraints), so guarded with a plain
-- not-exists check instead of ON CONFLICT.

begin;

with sides(side_code, side_label) as (
  values ('L', 'ซ้าย'), ('R', 'ขวา')
),
candidates as (
  select
    z.id as zone_id,
    r.id as room_id,
    z.zone_code || '-' || s.side_code || '-00' as location_code,
    z.zone_name || ' ฝั่ง' || s.side_label || ' รอจ่าย' as location_name,
    (
      select l.capacity
      from public.tgd_locations l
      where l.room_id = r.id and l.location_code like z.zone_code || '-' || s.side_code || '-%'
      order by l.location_code
      limit 1
    ) as capacity
  from public.tgd_zones z
  join public.tgd_rooms r on r.zone_id = z.id
  cross join sides s
  where z.zone_code in ('41', '42')
)
insert into public.tgd_locations (room_id, zone_id, name, location_code, location_name, capacity)
select c.room_id, c.zone_id, c.location_code, c.location_code, c.location_name, c.capacity
from candidates c
where c.capacity is not null
  and not exists (
    select 1 from public.tgd_locations existing where existing.location_code = c.location_code
  );

notify pgrst, 'reload schema';

commit;
