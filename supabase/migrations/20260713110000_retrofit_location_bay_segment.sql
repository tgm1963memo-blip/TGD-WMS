-- Retrofits the existing 348 locations (rooms 42/43, all in 4-segment
-- {room}-{side}-{row}-{level} format, e.g. "42-L-01-01") with the new
-- 5th "ตอน" (bay) segment added by this feature, so every location in the
-- system uses one consistent 5-segment format going forward. Existing
-- locations only ever had one physical bay per shelf position, so they're
-- retrofitted as bay 1 — matching the default new rooms get when "จำนวนตอน"
-- is left at its default of 1.
--
-- Only location_code/name (the identifier) and location_name (the Thai
-- display label) change — location_id stays the same UUID, so every
-- existing FK reference (stock balances, deposit lines, pallets, etc.)
-- is completely unaffected by this rename.

begin;

update public.tgd_locations
set
  location_code = location_code || '-01',
  name = name || '-01',
  location_name = location_name || ' ตอน1'
where location_code ~ '^.+-[LR]-\d+-\d+$';

commit;
