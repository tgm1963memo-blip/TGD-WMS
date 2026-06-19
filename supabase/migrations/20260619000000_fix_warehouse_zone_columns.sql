-- 20260619000000_fix_warehouse_zone_columns.sql
-- Ensure warehouse_code and temperature_type columns exist in case
-- the live DB was provisioned without migration 001 in full.

begin;

alter table public.tgd_warehouses
  add column if not exists warehouse_code text,
  add column if not exists warehouse_type text,
  add column if not exists address text;

-- Make warehouse_code unique where non-null
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tgd_warehouses_warehouse_code_key'
      and conrelid = 'public.tgd_warehouses'::regclass
  ) then
    alter table public.tgd_warehouses
      add constraint tgd_warehouses_warehouse_code_key unique (warehouse_code);
  end if;
end $$;

alter table public.tgd_zones
  add column if not exists temperature_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tgd_zones_temperature_type_check'
      and conrelid = 'public.tgd_zones'::regclass
  ) then
    alter table public.tgd_zones
      add constraint tgd_zones_temperature_type_check check (
        temperature_type is null or temperature_type in ('FROZEN', 'CHILLED', 'AMBIENT')
      );
  end if;
end $$;

commit;
