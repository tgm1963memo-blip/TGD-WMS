-- Phase 23K: Controlled Master Data Read Policy

alter table public.tgd_products enable row level security;
alter table public.tgd_warehouses enable row level security;

drop policy if exists tgd_products_authenticated_read_master on public.tgd_products;
create policy tgd_products_authenticated_read_master
  on public.tgd_products
  for select
  to authenticated
  using (true);

drop policy if exists tgd_warehouses_authenticated_read_master on public.tgd_warehouses;
create policy tgd_warehouses_authenticated_read_master
  on public.tgd_warehouses
  for select
  to authenticated
  using (true);
