-- 20260619000002_fix_tgd_warehouses_name.sql
-- Add warehouse_name column missing from base schema

begin;

alter table public.tgd_warehouses
  add column if not exists warehouse_name text;

commit;
