# Supabase Staging Smoke Test Plan

## Objective
Verify that the staging Supabase project behaves correctly after applying the SQL objects from Sprint 13I, without touching production.

## Prerequisites
- Staging Supabase URL and anon key are set in `.env.local`.
- Demo users and roles have been seeded (see seed data).
- All objects from the apply plan have been applied **in staging only** (not actually executed yet – this plan is for future execution).

## Test items
| # | Description | Expected result |
|---|-------------|-----------------|
| 1 | **Connection readiness** – Use the anon key to open a Supabase client and ping `pg_catalog.pg_tables`. | Connection succeeds, returns list of tables.
| 2 | **Auth role mapping** – Sign‑in as a demo `admin` user and query `tgd_user_profiles` to confirm role mapping. | `admin` role returned, `is_active = true`.
| 3 | **RLS isolation** – Sign‑in as a demo `warehouse_staff` with `customer_id = 111` and query `tgd_stock_balances`. | Only rows where `customer_id = 111` are returned.
| 4 | **RLS write restriction** – Attempt to `INSERT` directly into `tgd_stock_balances` as `warehouse_staff`. | Operation denied (permission error).
| 5 | **Seed data visibility** – Query `tgd_customers` and `tgd_products` as `viewer`. | All demo customers/products are visible (read‑only).
| 6 | **RPC dry‑run** – Call `tgd_rpc_create_stock_movement` with a valid JSON payload and the `dry_run` flag (if implemented). | RPC returns success without creating a movement record.
| 7 | **Movement insert** – Call the RPC without dry‑run to create a stock movement. | Movement is inserted, trigger fires.
| 8 | **Trigger verification** – After the movement insert, query `tgd_stock_balances` for the affected `customer_id`, `product_id`, `lot_id`, `location_id`. | Balance reflects the movement (quantity updated accordingly).
Stock balance validation confirms that tgd_stock_balances reflects the movement ledger after trigger execution.
| 9 | **Accounting charge preview** – As `accounting` role, query `tgd_monthly_storage_snapshots`. | Data returned, read‑only access.
|10 | **Audit log check** – Verify that actions above created entries in `tgd_audit_logs`. | Audit rows exist with appropriate `action_type`.
|11 | **No UI live write** – Ensure no frontend code attempts a direct `INSERT` into `tgd_stock_balances`. | No such code paths exist (manual code review).
|12 | **Forbidden term check** – Scan all applied SQL objects for forbidden business terms. | None found.

## Execution steps
1. Initialise Supabase client with anon key.
2. Perform each test sequentially, logging pass/fail.
3. If any test fails, abort further tests and roll back (see rollback plan).

## Pass/Fail criteria
- **Pass**: All 12 items succeed.
- **Fail**: Any item fails – record the failure, notify Controller, and execute rollback before any further apply.

## Reporting
- Produce a short markdown summary `smoke-test-result.md` with a table of results.
- Attach the report to the sprint validation document.

---
*Prepared only – no execution performed.*
