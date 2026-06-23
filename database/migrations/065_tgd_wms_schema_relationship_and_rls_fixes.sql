-- 065_tgd_wms_schema_relationship_and_rls_fixes.sql
-- Fix missing FK constraints, RLS policy gaps, and view grants.
-- Issues resolved:
--   1. tgd_stock_balances.location_id has no FK → PostgREST "Could not find a relationship" error
--   2. tgd_stock_movements RLS (migration 014) excluded accounting/warehouse_admin/viewer
--   3. tgd_unified_movements_v and tgd_billing_movement_weight_v may lack SELECT grants
--   4. tgd_stock_balances RLS excluded warehouse_admin/viewer

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. Add FK constraints on tgd_stock_balances (NOT VALID = skip existing row check)
--    Allows PostgREST to discover and use these relationships in nested selects.
-- ────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_balances_location_id'
      and table_name = 'tgd_stock_balances'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_balances
      add constraint fk_stock_balances_location_id
      foreign key (location_id) references public.tgd_locations(id)
      not valid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_balances_customer_id'
      and table_name = 'tgd_stock_balances'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_balances
      add constraint fk_stock_balances_customer_id
      foreign key (customer_id) references public.tgd_customers(id)
      not valid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_balances_product_id'
      and table_name = 'tgd_stock_balances'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_balances
      add constraint fk_stock_balances_product_id
      foreign key (product_id) references public.tgd_products(id)
      not valid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_balances_lot_id'
      and table_name = 'tgd_stock_balances'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_balances
      add constraint fk_stock_balances_lot_id
      foreign key (lot_id) references public.tgd_lots(id)
      not valid;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. Add FK constraints on tgd_stock_movements (NOT VALID)
-- ────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_movements_customer_id'
      and table_name = 'tgd_stock_movements'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_movements
      add constraint fk_stock_movements_customer_id
      foreign key (customer_id) references public.tgd_customers(id)
      not valid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_movements_product_id'
      and table_name = 'tgd_stock_movements'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_movements
      add constraint fk_stock_movements_product_id
      foreign key (product_id) references public.tgd_products(id)
      not valid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_stock_movements_lot_id'
      and table_name = 'tgd_stock_movements'
      and table_schema = 'public'
  ) then
    alter table public.tgd_stock_movements
      add constraint fk_stock_movements_lot_id
      foreign key (lot_id) references public.tgd_lots(id)
      not valid;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. Fix tgd_stock_movements RLS — restore accounting + add warehouse_admin, viewer
--    Migration 014 narrowed this to only admin/warehouse_manager, breaking billing.
-- ────────────────────────────────────────────────────────────────────────────────
drop policy if exists rls_stock_movements_read on public.tgd_stock_movements;

create policy rls_stock_movements_read
  on public.tgd_stock_movements
  for select
  using (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff',
      'accounting', 'viewer'
    )
    or public.tgd_current_user_customer_id() = customer_id
  );

-- ────────────────────────────────────────────────────────────────────────────────
-- 4. Fix tgd_stock_balances RLS — add warehouse_admin, viewer
--    Migration 014 excluded warehouse_admin and viewer.
-- ────────────────────────────────────────────────────────────────────────────────
drop policy if exists rls_stock_balances_read on public.tgd_stock_balances;

create policy rls_stock_balances_read
  on public.tgd_stock_balances
  for select
  using (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff',
      'accounting', 'viewer'
    )
    or public.tgd_current_user_customer_id() = customer_id
  );

-- ────────────────────────────────────────────────────────────────────────────────
-- 5. Grant SELECT on unified movement and billing views to authenticated role
-- ────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.tgd_unified_movements_v') is not null then
    execute 'grant select on public.tgd_unified_movements_v to authenticated';
  end if;

  if to_regclass('public.tgd_billing_movement_weight_v') is not null then
    execute 'grant select on public.tgd_billing_movement_weight_v to authenticated';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────────
-- 6. Notify PostgREST to reload schema cache so FK constraints become visible
-- ────────────────────────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
