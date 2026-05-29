-- 002_tgd_wms_rls_policy_foundation.sql
-- Prepared RLS policy foundation for TGD WMS.
-- Do NOT apply to a live Supabase instance until Controller approval.
-- This file only defines ENABLE ROW LEVEL SECURITY statements and policy skeletons.
-- RPC functions, triggers, and service_role usage are NOT included in this sprint.

-- ------------------------------------------------------------
-- Enable RLS on core tables
-- ------------------------------------------------------------

-- Master/reference tables
ALTER TABLE tgd_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_pallets ENABLE ROW LEVEL SECURITY;

-- Operational tables (customer owned data)
ALTER TABLE tgd_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_receiving_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_receiving_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_putaway_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_transfer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_adjustment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_stock_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_withdrawal_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_allocation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_picking_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_dispatch_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_operation_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_monthly_storage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_accounting_charge_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tgd_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Helper assumptions (not executed)
-- ------------------------------------------------------------
-- We assume a user profile table linking Supabase auth.uid() to a role and optional customer_id:
--   CREATE TABLE tgd_user_profiles (
--     id uuid PRIMARY KEY,
--     auth_user_id uuid NOT NULL, -- matches auth.uid()
--     role TEXT NOT NULL CHECK (role IN ('admin','warehouse_manager','warehouse_staff','accounting','viewer')),
--     customer_id uuid NULL
--   );
-- Policies will reference auth.uid() via the built‑in function auth.uid()

-- ------------------------------------------------------------
-- Policy definitions (table‑level, role‑based)
-- ------------------------------------------------------------

-- Example policy for master data (admin full, others read)
CREATE POLICY "admin_full_access_master" ON tgd_customers
  FOR ALL TO public USING (true) WITH CHECK (true);
-- In practice, you would replace "public" with role‑specific groups.

-- Customer‑owned tables: isolate by customer_id where applicable.
-- Example for stock balances (read‑only for staff, manager, accounting, viewer)
CREATE POLICY "stock_balances_read" ON tgd_stock_balances
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM tgd_user_profiles up WHERE up.auth_user_id = auth.uid() AND (
      up.role IN ('admin','warehouse_manager','warehouse_staff','accounting','viewer')
    ))
  );

-- Insert / Update policies will be added in future sprint via RPC.

-- ------------------------------------------------------------
-- Comments and warnings
-- ------------------------------------------------------------
-- NOTE: This file is a foundation only. Do NOT run against production until reviewed.
-- RPC functions and triggers are intentionally omitted.
-- Frontend must never use a service_role key; only the anon key is permitted.

-- End of 002_tgd_wms_rls_policy_foundation.sql
