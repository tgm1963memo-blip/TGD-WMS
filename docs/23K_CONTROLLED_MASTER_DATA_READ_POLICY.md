# 23K: Controlled Master Data Read Policy

## 1. Context & Verified Root Cause
Based on diagnostics from Phase 23J, the frontend successfully reaches the backend, but `tgd_products` and `tgd_warehouses` return `0 rows` silently. Manual SQL verification confirms that data exists in these tables. The root cause is confirmed: Row-Level Security (RLS) is enabled on these tables, but no `SELECT` policies are defined, inherently defaulting to `DENY ALL` for frontend queries. (Note: `tgd_customers` had an existing permissive policy which is why it loaded correctly.)

## 2. Policy Migration Details
We have formulated migration `031_tgd_wms_controlled_master_data_read_policy.sql` to explicitly grant read access to the missing master data tables.

**Affected Tables:**
- `public.tgd_products`
- `public.tgd_warehouses`

**Policy Scope:**
- Grants strictly `SELECT` (read-only) capabilities.
- Contains absolutely no `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` grants.
- Binds `TO authenticated`, ensuring that only properly logged-in users (or matching Playwright simulated profiles) can read the master data schemas. This is fundamentally safer than `public` or `anon` access.

## 3. Retest Protocol
After this migration is executed by the database administrator, the UAT automation can be re-run with:
```bash
npx playwright test "tests/e2e/transaction-uat-round-1.spec.js" --headed
```

## 4. Security & Rollout Boundaries
> [!WARNING]
> **Production Context**
> - **This migration has NOT been automatically applied to the database.**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
