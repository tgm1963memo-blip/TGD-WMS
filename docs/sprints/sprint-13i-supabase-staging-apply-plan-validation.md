# Sprint 13I – Supabase Staging Apply Plan Validation

## Summary
This document validates that all deliverables for Sprint 13I have been created and contain the required content. No SQL has been executed, no UI has been connected, and no real Supabase keys or URLs are present.

## Files added/updated
- `docs/deployment/supabase-staging-apply-plan.md`
- `docs/deployment/supabase-staging-validation-sql-checklist.md`
- `docs/deployment/supabase-staging-rollback-plan.md`
- `docs/deployment/supabase-staging-smoke-test-plan.md`
- `docs/deployment/supabase-staging-apply-risk-register.md`
- `docs/sprints/sprint-13i-supabase-staging-apply-plan-validation.md` (this file)
- `tests/unit/supabase-staging-apply-plan.test.js`

## Apply order summary
1. `database/migrations/001_tgd_wms_schema_foundation.sql`
2. `database/policies/002_tgd_wms_rls_policy_foundation.sql`
3. `database/policies/004_tgd_wms_customer_isolation_rls_refinement.sql`
4. `database/seeds/003_tgd_wms_seed_data_foundation.sql`
5. `database/rpc/005_tgd_wms_rpc_stock_movement_foundation.sql`
6. `database/triggers/006_tgd_wms_stock_balance_trigger_design.sql`

## Prerequisite checklist summary
All items are ticked in the apply‑plan document, including staging project creation, `.env.local` usage, backup of staging, and confirmation that seed data contains no real customer data.

## Environment handling summary
- Staging keys are stored only in `.env.local` (not committed).
- No `SUPABASE_SERVICE_ROLE_KEY` is referenced in any frontend or documentation.

## Validation SQL checklist summary
The checklist enumerates required tables, RLS policies, RPC functions, triggers, and confirms the absence of forbidden business terms and `service_role` usage.

## Smoke test plan summary
The plan defines 12 concrete test items covering connection, auth mapping, RLS isolation, RPC dry‑run, trigger verification, accounting preview, audit logs, and forbidden‑term checks.

## Rollback plan summary
Provides step‑by‑step SQL to drop the trigger, RPC function, truncate seed data, drop RLS policies, and optionally restore a full backup.

## Risk register summary
Contains 12 risks with severity, likelihood, mitigation, owner, and status. Notably includes:
- Wrong Supabase project/environment (R01)
- Accidental production apply (R02)
- Service‑role key exposure (R03)
- Customer data leakage (R10)

## Production safety confirmation
- Every document explicitly states **Do NOT apply to production**.
- Controller approval is required before any `supabase db push`.

## Service role safety confirmation
- No `service_role` key appears in any code or documentation.
- Only a comment reminder is present in the rollback plan.

## Forbidden naming check
All docs were scanned; no forbidden business terms were found.

## No live Supabase apply confirmation
- No `supabase db push`, `psql`, or direct SQL execution has been performed.
- All files are marked **Prepared only**.

## No UI live write confirmation
- No frontend code references `INSERT` into Supabase tables.
- UI connection to Supabase is not implemented.

## No real transaction write confirmation
- No real stock movements or accounting entries have been created.

## Targeted test result
`npx vitest run tests/unit/supabase-staging-apply-plan.test.js` → **Executed** (all tests passed).

## Full npm test result
**PASS** – All 510 tests in the project pass.

## Build result
`npm run build` → **PASS** (build succeeded).

## Known gaps
- Performance testing of RPC under load is out of scope.
- Auditing of `service_role` usage is limited to comments.
- Future schema additions (`warehouse_id`, `pallet_id`) are not covered.

## Final recommendation
All documentation and validation artefacts are ready. Await **Controller approval** before any actual staging apply. Once approved, the DevOps team can execute the apply sequence, run the smoke test plan, and, if needed, follow the rollback plan.

---
*Prepared only – no SQL executed, no Supabase connection made.*
