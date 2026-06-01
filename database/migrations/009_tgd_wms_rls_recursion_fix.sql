-- 009_tgd_wms_rls_recursion_fix.sql
-- Fix RLS infinite recursion by replacing direct tgd_user_profiles policy lookups
-- with SECURITY DEFINER helper functions.
-- Staging first. No production apply without approval.

create or replace function public.tgd_current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.role
  from public.tgd_user_profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function public.tgd_current_user_customer_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.customer_id
  from public.tgd_user_profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function public.tgd_current_user_is_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tgd_user_profiles p
    where p.auth_user_id = auth.uid()
      and p.is_active = true
  )
$$;

grant execute on function public.tgd_current_user_role() to authenticated;
grant execute on function public.tgd_current_user_customer_id() to authenticated;
grant execute on function public.tgd_current_user_is_active() to authenticated;

drop policy if exists rls_user_profiles on public.tgd_user_profiles;
create policy rls_user_profiles
on public.tgd_user_profiles
for all
using (
  public.tgd_current_user_role() = 'admin'
);

drop policy if exists rls_accounting_charge_staging on public.tgd_accounting_charge_staging;
create policy rls_accounting_charge_staging
on public.tgd_accounting_charge_staging
for select
using (
  public.tgd_current_user_role() in ('admin', 'accounting')
);

drop policy if exists rls_monthly_storage_snapshots on public.tgd_monthly_storage_snapshots;
create policy rls_monthly_storage_snapshots
on public.tgd_monthly_storage_snapshots
for select
using (
  public.tgd_current_user_role() in ('admin', 'accounting')
);

drop policy if exists rls_operation_charges on public.tgd_operation_charges;
create policy rls_operation_charges
on public.tgd_operation_charges
for select
using (
  public.tgd_current_user_role() in ('admin', 'accounting')
);

drop policy if exists rls_audit_logs on public.tgd_audit_logs;
create policy rls_audit_logs
on public.tgd_audit_logs
for select
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
);

drop policy if exists rls_receiving_documents on public.tgd_receiving_documents;
create policy rls_receiving_documents
on public.tgd_receiving_documents
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_putaway_tasks on public.tgd_putaway_tasks;
create policy rls_putaway_tasks
on public.tgd_putaway_tasks
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_transfer_documents on public.tgd_transfer_documents;
create policy rls_transfer_documents
on public.tgd_transfer_documents
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_adjustment_documents on public.tgd_adjustment_documents;
create policy rls_adjustment_documents
on public.tgd_adjustment_documents
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_stock_count_sessions on public.tgd_stock_count_sessions;
create policy rls_stock_count_sessions
on public.tgd_stock_count_sessions
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_withdrawal_requests on public.tgd_withdrawal_requests;
create policy rls_withdrawal_requests
on public.tgd_withdrawal_requests
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_allocation_records on public.tgd_allocation_records;
create policy rls_allocation_records
on public.tgd_allocation_records
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_picking_tasks on public.tgd_picking_tasks;
create policy rls_picking_tasks
on public.tgd_picking_tasks
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_dispatch_documents on public.tgd_dispatch_documents;
create policy rls_dispatch_documents
on public.tgd_dispatch_documents
for all
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_stock_balances_read on public.tgd_stock_balances;
drop policy if exists stock_balances_read on public.tgd_stock_balances;
create policy rls_stock_balances_read
on public.tgd_stock_balances
for select
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer')
  or public.tgd_current_user_customer_id() = customer_id
);

drop policy if exists rls_stock_movements_read on public.tgd_stock_movements;
create policy rls_stock_movements_read
on public.tgd_stock_movements
for select
using (
  public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'viewer')
  or public.tgd_current_user_customer_id() = customer_id
);