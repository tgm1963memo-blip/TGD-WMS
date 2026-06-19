-- 20260619000006_fix_zones_columns.sql
-- Live DB tgd_zones was provisioned from old schema (001_tgd_wms_schema_foundation.sql)
-- which only has 'name' and 'code' columns, not 'zone_code'/'zone_name'.
-- Add the missing columns so app code works correctly.

begin;

-- Add zone_code and zone_name to tgd_zones
alter table public.tgd_zones
  add column if not exists zone_code text,
  add column if not exists zone_name text;

-- Copy existing 'code' → zone_code and 'name' → zone_name for legacy rows
update public.tgd_zones
set zone_code = code,
    zone_name = name
where zone_code is null and code is not null;

update public.tgd_zones
set zone_name = name
where zone_name is null and name is not null;

-- Add unique constraint (warehouse_id, zone_code) if not present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tgd_zones_warehouse_zone_code_unique'
      and conrelid = 'public.tgd_zones'::regclass
  ) then
    alter table public.tgd_zones
      add constraint tgd_zones_warehouse_zone_code_unique unique (warehouse_id, zone_code);
  end if;
end $$;

-- Enable RLS and add write policy for admin/warehouse roles
alter table public.tgd_zones enable row level security;

drop policy if exists tgd_zones_read on public.tgd_zones;
create policy tgd_zones_read
  on public.tgd_zones for select to authenticated using (true);

drop policy if exists tgd_zones_admin_write on public.tgd_zones;
create policy tgd_zones_admin_write
  on public.tgd_zones for all to authenticated
  using (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'))
  with check (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'));

grant select, insert, update, delete on public.tgd_zones to authenticated;

-- Also add write policy for tgd_locations (needed when creating locations in rooms)
alter table public.tgd_locations enable row level security;

drop policy if exists tgd_locations_admin_write on public.tgd_locations;
create policy tgd_locations_admin_write
  on public.tgd_locations for all to authenticated
  using (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'))
  with check (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'));

grant select, insert, update, delete on public.tgd_locations to authenticated;

-- Add warehouse_code unique constraint if not present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tgd_warehouses_warehouse_code_key'
      and conrelid = 'public.tgd_warehouses'::regclass
  ) then
    -- Only add if no duplicate warehouse_codes exist
    if (select count(distinct warehouse_code) from public.tgd_warehouses where warehouse_code is not null)
       = (select count(*) from public.tgd_warehouses where warehouse_code is not null) then
      alter table public.tgd_warehouses
        add constraint tgd_warehouses_warehouse_code_key unique (warehouse_code);
    end if;
  end if;
end $$;

-- Ensure warehouses RLS allows admin write
alter table public.tgd_warehouses enable row level security;

drop policy if exists tgd_warehouses_read on public.tgd_warehouses;
create policy tgd_warehouses_read
  on public.tgd_warehouses for select to authenticated using (true);

drop policy if exists tgd_warehouses_admin_write on public.tgd_warehouses;
create policy tgd_warehouses_admin_write
  on public.tgd_warehouses for all to authenticated
  using (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'))
  with check (public.tgd_current_user_role() in ('admin','warehouse_admin','warehouse_manager'));

grant select, insert, update, delete on public.tgd_warehouses to authenticated;

commit;
