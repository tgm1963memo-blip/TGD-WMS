-- 014_tgd_wms_viewer_customer_isolation_fix.sql
-- Tighten customer isolation for viewer and customer-bound warehouse staff.
-- Staging first. No production apply without approval.

drop policy if exists rls_stock_balances_read on public.tgd_stock_balances;
drop policy if exists stock_balances_read on public.tgd_stock_balances;

create policy rls_stock_balances_read
on public.tgd_stock_balances
for select
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'accounting')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_stock_movements_read on public.tgd_stock_movements;

create policy rls_stock_movements_read
on public.tgd_stock_movements
for select
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);