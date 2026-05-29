-- 004_tgd_wms_customer_isolation_rls_refinement.sql

-- Prepared RLS refinement only. Review before applying to Supabase.
-- This file contains policy definitions only. Function, trigger, and privileged server key handling are outside this file.
-- Future RPC will handle controlled stock movement writes.
-- Direct frontend updates to tgd_stock_balances are prohibited.

-- Helper condition used in many policies (replace <TABLE> with actual table alias)
-- Example usage: 
--   USING (EXISTS (
--     SELECT 1 FROM tgd_user_profiles p
--     WHERE p.auth_user_id = auth.uid()
--       AND p.is_active = true
--       AND (
--         p.role IN ('admin','warehouse_manager')
--         OR p.customer_id = <TABLE>.customer_id
--       )
--   ))

-- -----------------------------------------------------------------------------
-- 1. Operational tables with customer_id
-- -----------------------------------------------------------------------------

-- Receiving documents
CREATE POLICY "rls_receiving_documents" ON tgd_receiving_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_receiving_documents.customer_id
        )
    )
  );

-- Putaway tasks
CREATE POLICY "rls_putaway_tasks" ON tgd_putaway_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_putaway_tasks.customer_id
        )
    )
  );

-- Transfer documents
CREATE POLICY "rls_transfer_documents" ON tgd_transfer_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_transfer_documents.customer_id
        )
    )
  );

-- Adjustment documents
CREATE POLICY "rls_adjustment_documents" ON tgd_adjustment_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_adjustment_documents.customer_id
        )
    )
  );

-- Stock count sessions
CREATE POLICY "rls_stock_count_sessions" ON tgd_stock_count_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_stock_count_sessions.customer_id
        )
    )
  );

-- Withdrawal requests
CREATE POLICY "rls_withdrawal_requests" ON tgd_withdrawal_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_withdrawal_requests.customer_id
        )
    )
  );

-- Allocation records
CREATE POLICY "rls_allocation_records" ON tgd_allocation_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_allocation_records.customer_id
        )
    )
  );

-- Picking tasks
CREATE POLICY "rls_picking_tasks" ON tgd_picking_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_picking_tasks.customer_id
        )
    )
  );

-- Dispatch documents
CREATE POLICY "rls_dispatch_documents" ON tgd_dispatch_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager')
          OR p.customer_id = tgd_dispatch_documents.customer_id
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Stock balances – read only, writes via future RPC
-- -----------------------------------------------------------------------------

CREATE POLICY "rls_stock_balances_read" ON tgd_stock_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager','accounting','viewer')
          OR p.customer_id = tgd_stock_balances.customer_id
        )
    )
  );

-- No INSERT/UPDATE/DELETE policies – writes must go through RPC (future).

-- -----------------------------------------------------------------------------
-- 3. Stock movements – read only, writes via future RPC
-- -----------------------------------------------------------------------------

CREATE POLICY "rls_stock_movements_read" ON tgd_stock_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('admin','warehouse_manager','warehouse_staff','viewer')
          OR p.customer_id = tgd_stock_movements.customer_id
        )
    )
  );

-- No INSERT/UPDATE/DELETE – future RPC will handle movement writes.

-- -----------------------------------------------------------------------------
-- 4. Accounting charge tables – read only for accounting and admin
-- -----------------------------------------------------------------------------

CREATE POLICY "rls_operation_charges" ON tgd_operation_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin','accounting')
    )
  );

CREATE POLICY "rls_monthly_storage_snapshots" ON tgd_monthly_storage_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin','accounting')
    )
  );

CREATE POLICY "rls_accounting_charge_staging" ON tgd_accounting_charge_staging
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin','accounting')
    )
  );

-- -----------------------------------------------------------------------------
-- 5. User profiles – admin only
-- -----------------------------------------------------------------------------

CREATE POLICY "rls_user_profiles" ON tgd_user_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND p.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Audit logs – admin and warehouse_manager only
-- -----------------------------------------------------------------------------

CREATE POLICY "rls_audit_logs" ON tgd_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tgd_user_profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin','warehouse_manager')
    )
  );

-- End of 004_tgd_wms_customer_isolation_rls_refinement.sql
