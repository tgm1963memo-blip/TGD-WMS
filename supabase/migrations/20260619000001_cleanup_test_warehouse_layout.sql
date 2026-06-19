-- 20260619000001_cleanup_test_warehouse_layout.sql
-- Remove all test/legacy warehouse layout data so the location count
-- starts from zero before the admin sets up rooms via the new UI.
-- Admin confirmed: all existing data is test/seed data only.
-- NOTE: tgd_rooms does not exist in live DB yet (created in 000004).

begin;

-- Null out location_id in tables that allow null
update public.tgd_stock_balances set location_id = null where location_id is not null;

-- tgd_pallets.location_id is NOT NULL — drop constraint so we can clear it
alter table public.tgd_pallets alter column location_id drop not null;
update public.tgd_pallets set location_id = null where location_id is not null;

-- Delete layout rows in FK order (child → parent)
-- tgd_rooms does not yet exist in live DB; locations reference zones directly
delete from public.tgd_locations;
delete from public.tgd_zones;

commit;
