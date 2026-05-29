# Supabase Staging Validation SQL Checklist

## Validation items
- Verify required tables exist after each apply step:
  - `tgd_customers`, `tgd_products`, `tgd_stock_balances`, `tgd_stock_movements`
  - `tgd_user_profiles`, `tgd_warehouses`, `tgd_zones`, `tgd_locations`
  - Accounting tables: `tgd_operation_charges`, `tgd_monthly_storage_snapshots`, `tgd_accounting_charge_staging`
  - Audit table: `tgd_audit_logs`
- Verify RLS policies are enabled on all tables containing `customer_id`.
- Verify policies exist for each table (e.g., `policy_tgd_stock_balances` etc.).
- Verify demo roles exist after seed (admin, warehouse_manager, warehouse_staff, accounting, viewer).
- Verify demo customers exist after seed.
- Verify RPC function `tgd_rpc_create_stock_movement` exists and is `SECURITY DEFINER`.
- Verify trigger `tgd_trigger_update_stock_balance` exists and is `SECURITY DEFINER`.
- Verify **no forbidden business terms** appear in any object definitions:
  - `sales_order`, `sales_orders`, `so_`, `outbound_orders`, `invoice`, `invoice_lines`.
- Verify **no service_role** usage in any SQL objects (only comment warnings).
- Verify **no real Supabase URLs** are present in any files.

> **Prepared only – no SQL executed.**
