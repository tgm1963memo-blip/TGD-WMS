-- 033_tgd_wms_controlled_location_read_policy.sql
-- Phase 23N: Controlled Location Master Read Policy for Receiving UAT
-- Grants read-only access to tgd_locations for authenticated users.

alter table public.tgd_locations enable row level security;

drop policy if exists tgd_locations_authenticated_read_master on public.tgd_locations;
create policy tgd_locations_authenticated_read_master
  on public.tgd_locations
  for select
  to authenticated
  using (true);
