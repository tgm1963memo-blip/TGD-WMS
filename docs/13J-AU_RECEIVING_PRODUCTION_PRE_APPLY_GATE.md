# 13J-AU Receiving Production Pre-Apply Gate

**EXPLICIT STATEMENT: Production is strictly NOT touched during this sprint. This document serves entirely as an evaluative pre-apply gate check.**

## Repository State
- **Current Repository Commit**: `464513d Add receiving production apply runbook` (or latest subsequent commit prior to apply)
- **Branch**: `main`

## Required Confirmations Before Production Apply
- [ ] **Production Target Confirmation**: Verified that the Supabase CLI is linked strictly to the Production project ID.
- [ ] **Backup / PITR Confirmation**: A full Point-In-Time-Recovery (PITR) snapshot of Production is captured and validated immediately before the deployment window.
- [ ] **Downtime Window Confirmation**: A dedicated maintenance window is scheduled, and all relevant operational personnel have been notified.
- [ ] **Operator Approval**: Explicit sign-off provided by the System Administrator and Warehouse Manager to proceed.

## Migrations to Apply
The following strictly additive/RPC-replacing migrations are staged for application:
1. `020_tgd_wms_receiving_real_stock_posting_draft.sql`
2. `021_tgd_wms_stock_privilege_hardening.sql`
3. `022_tgd_wms_stock_balance_last_movement_traceability.sql`
4. `023_tgd_wms_receiving_add_line_location_rpc_patch.sql`
5. `024_tgd_wms_receiving_audit_rpc_patch.sql`

## "Do Not Proceed If" Checklist (Stop Conditions)
DO NOT PROCEED with the rollout if any of the following are true:
- [ ] The PITR backup fails or cannot be verified.
- [ ] The designated maintenance window has expired or operations are still actively using legacy flows.
- [ ] Any automated test in the CI/CD pipeline fails prior to deployment.
- [ ] Unresolved SQL syntax or logic errors arise during dry runs.
- [ ] Any required sign-off (System Admin, Warehouse Manager, Controller) is missing.
- [ ] There is an urge to insert manual stock movements or update stock balances directly. (Under no circumstances should manual stock movement inserts or manual stock balance updates be executed to fix drift. NO manual stock movement insert. NO manual stock balance update.)

## Final Go/No-Go

| Role | Name | Signature | Status | Date |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | | | [ ] Go / [ ] No-Go | |
| **Warehouse Manager** | | | [ ] Go / [ ] No-Go | |
| **Controller** | | | [ ] Go / [ ] No-Go | |
