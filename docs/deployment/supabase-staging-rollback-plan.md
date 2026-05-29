# Supabase Staging Rollback Plan

## Rollback principles
- Reversible: every applied change must have a clear undo step.
- Minimal impact: only affect objects created in this staging apply.
- Documentation: record which step was rolled back and why.

## Before‑apply backup checklist
- Take a full schema dump of the staging database (`pg_dump --schema-only`).
- Export data of existing tables that will be overwritten by seed data.
- Store dumps in a secure location (CI artefact store) with timestamp.

## Rollback steps (by SQL file group)
-- Disable trigger
1. **Trigger rollback**
   ```sql
   DROP TRIGGER IF EXISTS tgd_trigger_update_stock_balance ON tgd_stock_movements;
   DROP FUNCTION IF EXISTS tgd_trigger_update_stock_balance();
   ```
-- Drop RPC functions
2. **RPC rollback**
   ```sql
   DROP FUNCTION IF EXISTS tgd_rpc_create_stock_movement(jsonb);
   ```
-- Remove seed demo data
3. **Seed data rollback**
   - Truncate demo tables (customers, products, warehouses, user_profiles) or restore from backup.
   ```sql
   TRUNCATE TABLE tgd_customers RESTART IDENTITY CASCADE;
   TRUNCATE TABLE tgd_products RESTART IDENTITY CASCADE;
   TRUNCATE TABLE tgd_user_profiles RESTART IDENTITY CASCADE;
   ```
4. **RLS policy rollback**
   - Drop the refined policy files (004) and foundation policies (002) if they were newly added.
   ```sql
   DROP POLICY IF EXISTS policy_tgd_stock_balances ON tgd_stock_balances;
   -- repeat for each policy created in this apply
   ```
5. **Schema rollback**
   - If the schema foundation (`001`) introduced new tables that are not needed, drop them.
   ```sql
   DROP TABLE IF EXISTS tgd_stock_balances;
   DROP TABLE IF EXISTS tgd_stock_movements;
   -- etc.
   ```
6. **Restore backup** (emergency)
   - Reload the schema dump taken before the apply.
   ```bash
   psql $SUPABASE_URL -f staging_schema_backup.sql
   ```

## Disabling trigger plan (partial rollback)
- If only the trigger needs to be disabled without dropping the function:
  ```sql
  ALTER TABLE tgd_stock_movements DISABLE TRIGGER tgd_trigger_update_stock_balance;
  ```

## Emergency stop criteria
- Any test fails after an apply step.
- Unexpected data loss or corruption detected.
- Security audit reveals over‑permissive RLS.

## Who approves rollback
- The Controller (designated lead) must record approval in the sprint validation report.
- The DevOps engineer performs the rollback steps.

## Evidence required after rollback
- Re‑run the validation SQL checklist – all items must return to the *pre‑apply* state.
- Confirm no demo seed rows remain (except intentional baseline data).
- Verify that RLS policies are no longer present for the rolled‑back tables.
- Log the rollback timestamp and SHA of the commit that triggered the apply.

> **Prepared only – no SQL executed.**
