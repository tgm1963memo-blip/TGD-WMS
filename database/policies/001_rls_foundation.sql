alter table tgd_customers enable row level security;
alter table tgd_products enable row level security;
alter table tgd_warehouses enable row level security;
alter table tgd_zones enable row level security;
alter table tgd_rooms enable row level security;
alter table tgd_locations enable row level security;
alter table tgd_pallets enable row level security;
alter table tgd_lots enable row level security;
alter table tgd_inventory_movements enable row level security;
alter table tgd_stock_balances enable row level security;
alter table tgd_user_profiles enable row level security;
alter table tgd_audit_logs enable row level security;

create policy tgd_customers_inventory_view_policy
  on tgd_customers
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_products_inventory_view_policy
  on tgd_products
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_warehouses_inventory_view_policy
  on tgd_warehouses
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_zones_inventory_view_policy
  on tgd_zones
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_rooms_inventory_view_policy
  on tgd_rooms
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_locations_inventory_view_policy
  on tgd_locations
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_pallets_inventory_view_policy
  on tgd_pallets
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_lots_inventory_view_policy
  on tgd_lots
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_inventory_movements_view_policy
  on tgd_inventory_movements
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_stock_balances_view_policy
  on tgd_stock_balances
  for select
  to authenticated
  using (tgd_can_view_inventory());

create policy tgd_inventory_movements_insert_policy
  on tgd_inventory_movements
  for insert
  to authenticated
  with check (tgd_can_post_inventory_movement());

create policy tgd_audit_logs_view_policy
  on tgd_audit_logs
  for select
  to authenticated
  using (tgd_can_view_audit_logs());

create policy tgd_user_profiles_self_view_policy
  on tgd_user_profiles
  for select
  to authenticated
  using (auth_user_id = auth.uid() or tgd_is_admin());

create policy tgd_user_profiles_admin_insert_policy
  on tgd_user_profiles
  for insert
  to authenticated
  with check (tgd_is_admin());

create policy tgd_user_profiles_admin_update_policy
  on tgd_user_profiles
  for update
  to authenticated
  using (tgd_is_admin())
  with check (tgd_is_admin());

create policy tgd_user_profiles_admin_delete_policy
  on tgd_user_profiles
  for delete
  to authenticated
  using (tgd_is_admin());

