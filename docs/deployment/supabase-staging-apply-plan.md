# Supabase Staging Apply Plan

## Purpose
Create a controlled, reversible apply of the TGD WMS schema and related objects to a **Staging** Supabase project. This allows validation of RLS policies, RPC functions, triggers and seed data before any production deployment.

## Staging‑only warning
**Do NOT apply this plan to a production Supabase project.** This document is for staging environments only.

## Production safety warning
Any execution of the listed SQL files against a production database **must be prevented**. Controller approval is required before any apply.

## Prerequisite checklist
- [ ] Staging Supabase project created and separate from production.
- [ ] `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the staging project **only**.
- [ ] No real customer confidential data in seed files.
- [ ] Backup of current staging schema (dump) taken.
- [ ] All team members aware of the no‑production‑apply rule.

## Apply order
1. `database/migrations/001_tgd_wms_schema_foundation.sql`
2. `database/policies/002_tgd_wms_rls_policy_foundation.sql`
3. `database/policies/004_tgd_wms_customer_isolation_rls_refinement.sql`
4. `database/seeds/003_tgd_wms_seed_data_foundation.sql`
5. `database/rpc/005_tgd_wms_rpc_stock_movement_foundation.sql`
6. `database/triggers/006_tgd_wms_stock_balance_trigger_design.sql`

**Do not apply to production.**
**Controller approval required before any apply.**

## Expected files to apply
All files listed in the **Apply order** section above must be applied in the exact sequence.

## Environment variable handling
- Use `.env.local` for staging keys; never commit this file.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is **not** referenced in any frontend code or documentation.

## Supabase project separation
- Staging project URL and anon key are different from production.
- Access to the staging service_role key is limited to CI pipelines for migration only.

## Role/User preparation notes
- Create demo roles: `admin`, `warehouse_manager`, `warehouse_staff`, `accounting`, `viewer` in staging via SQL seed.
- Assign demo users in `tgd_user_profiles` with non‑null `customer_id` for customer‑scoped testing.

## Seed data preparation notes
- Seed data contains only demo customers, products, and warehouses. No real customer data.
- Verify seed files do **not** contain any forbidden business terms.

## Validation checklist
- Verify tables exist after each apply step.
- Verify RLS policies are enabled on all tables containing `customer_id`.
- Verify RPC functions are created and have `SECURITY DEFINER`.
- Verify trigger `tgd_trigger_update_stock_balance` exists and is `SECURITY DEFINER`.
- Verify no forbidden terms (sales, invoice, etc.) appear in any object definitions.

## Smoke test plan
- Connect to staging Supabase using anon key.
- Authenticate as a demo `admin` user and verify full read/write access.
- Authenticate as a demo `warehouse_staff` user and verify customer‑scoped isolation.
- Call RPC `tgd_rpc_create_stock_movement` with a demo payload (dry‑run) and ensure it succeeds.
- Insert a demo stock movement record and confirm the stock balance trigger updates the balance correctly.
- Query accounting charge summary tables for read‑only access.
- Verify audit logs are populated for the actions.

## Rollback plan
- Disable trigger.
- Drop RPC functions.
- Remove seed demo data (truncate tables).
- Revert RLS policy changes.
- Restore previous staging dump if needed.

## Go/No‑Go gate
- All prerequisite checklist items must be ✅.
- Validation checklist must pass.
- Smoke test must pass.
- Controller sign‑off recorded before any apply.

## Known gaps
- Full performance testing of RPC under load is out of scope for this sprint.
- Auditing of `service_role` usage is only a comment reminder.
- Future schema changes (e.g., `warehouse_id`, `pallet_id`) are not covered.

---
*Prepared only – no SQL executed.*
