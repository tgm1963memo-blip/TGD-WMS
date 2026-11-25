-- Zones inside a room and custom row names (display only).
--
-- tgd_location_groups: a named, coloured run of consecutive rows on one side
-- of a room (tgd_zones row = the room), e.g. "โซน A · OVO" = side L rows
-- 21-30. Rows outside every zone keep working as before. Zones never touch
-- stock: deleting one only removes the label.
--
-- tgd_locations.display_name: an optional name shown instead of "แถว 30"
-- (e.g. "A30"). location_code (41-L-30) is unchanged, because sticker QR
-- codes and movement history refer to it.
--
-- Same access as tgd_locations: everyone signed in reads, admin /
-- warehouse_admin / warehouse_manager write. Idempotent.

begin;

alter table public.tgd_locations
  add column if not exists display_name text;

create table if not exists public.tgd_location_groups (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.tgd_zones(id) on delete cascade,
  name text not null,
  color text not null default 'blue',
  side text not null,
  row_from integer not null,
  row_to integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_location_groups_side_check check (side in ('L', 'R', 'A')),
  constraint tgd_location_groups_rows_check check (row_from >= 0 and row_to >= row_from),
  constraint tgd_location_groups_name_check check (length(btrim(name)) > 0)
);

create index if not exists tgd_location_groups_zone_idx on public.tgd_location_groups (zone_id);

alter table public.tgd_location_groups enable row level security;

drop policy if exists tgd_location_groups_read on public.tgd_location_groups;
create policy tgd_location_groups_read
on public.tgd_location_groups
for select
to authenticated
using (true);

drop policy if exists tgd_location_groups_admin_write on public.tgd_location_groups;
create policy tgd_location_groups_admin_write
on public.tgd_location_groups
for all
to authenticated
using (public.tgd_current_user_role() = any (array['admin', 'warehouse_admin', 'warehouse_manager']))
with check (public.tgd_current_user_role() = any (array['admin', 'warehouse_admin', 'warehouse_manager']));

grant select, insert, update, delete on public.tgd_location_groups to authenticated;

notify pgrst, 'reload schema';
commit;
