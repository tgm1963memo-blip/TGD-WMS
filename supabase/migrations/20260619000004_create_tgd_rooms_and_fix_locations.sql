-- 20260619000004_create_tgd_rooms_and_fix_locations.sql
-- Create tgd_rooms intermediate table (zone → room → location hierarchy)
-- and add room_id FK to tgd_locations to match app schema.

begin;

-- Create tgd_rooms table (mirrors 001_core_master_data.sql)
create table if not exists public.tgd_rooms (
  id           uuid primary key default gen_random_uuid(),
  zone_id      uuid not null references public.tgd_zones(id) on delete cascade,
  room_code    text not null,
  room_name    text,
  temperature_min numeric,
  temperature_max numeric,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tgd_rooms_zone_room_code_unique unique (zone_id, room_code)
);

-- Enable RLS (allow authenticated users to read; admin writes via service role)
alter table public.tgd_rooms enable row level security;

drop policy if exists tgd_rooms_authenticated_read on public.tgd_rooms;
create policy tgd_rooms_authenticated_read
  on public.tgd_rooms for select to authenticated using (true);

drop policy if exists tgd_rooms_admin_write on public.tgd_rooms;
create policy tgd_rooms_admin_write
  on public.tgd_rooms for all to authenticated
  using (public.tgd_current_user_role() in ('admin', 'warehouse_admin', 'warehouse_manager'))
  with check (public.tgd_current_user_role() in ('admin', 'warehouse_admin', 'warehouse_manager'));

grant select, insert, update, delete on public.tgd_rooms to authenticated;

-- Add room_id column to tgd_locations (nullable; new locations will always have it set)
alter table public.tgd_locations
  add column if not exists room_id uuid references public.tgd_rooms(id) on delete cascade;

-- Add location_code / location_name if not present (old schema used just "name")
alter table public.tgd_locations
  add column if not exists location_code text,
  add column if not exists location_name text;

-- Add is_active if not present on zones/rooms/locations
alter table public.tgd_zones
  add column if not exists is_active boolean not null default true;

commit;
