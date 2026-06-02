# 13J-AS Receiving Production Readiness Review

## Readiness Summary
Receiving features have completed extensive testing in the Staging environment. All automated tests (unit, integration) and simulated runtime verifications have passed successfully. No production touched during the validation phases. 

The Staging database successfully demonstrated correct end-to-end execution, ensuring data consistency and tracing for stock balances and movements.

## Migration Readiness
The following migrations are required to implement Receiving on Production:
- **020_tgd_wms_receiving_real_stock_posting_draft.sql**: Introduces real stock posting functionality.
- **021_tgd_wms_stock_privilege_hardening.sql**: Reinforces RLS rules and strict permissions for stock interactions.
- **022_tgd_wms_stock_balance_last_movement_traceability.sql**: Implements trigger changes to populate `last_movement_id` on balances.
- **023_tgd_wms_receiving_add_line_location_rpc_patch.sql**: Requires `location_id` directly in the `add_receiving_line` RPC.
- **024_tgd_wms_receiving_audit_rpc_patch.sql**: Adds audit trail attributes (`created_by`, `posted_by`, `posted_at`). Includes schema drift alignment for `001/004` column mismatch on Staging.

*Note: All migrations are exclusively additive or DDL-based RPC replacements without business data modifications.*

## RPC Readiness
All frontend writes are strictly limited to the RPC wrapper contracts:
- `tgd_rpc_create_receiving_draft`
- `tgd_rpc_add_receiving_line`
- `tgd_rpc_post_receiving_document`

**Validations Complete:**
- Active profile and role authorization guard check verified.
- Audit fields reliably captured via the 024 migration.
- Comprehensive trace fields on `tgd_stock_movements`.
- Idempotency guard on `tgd_rpc_post_receiving_document` confirmed.
- No direct stock balance update from RPC; triggers correctly handle balance derivations.

## Frontend Readiness
- **Pages Checked:** `ReceivingListPage`, `ReceivingCreatePage`, `ReceivingDetailPage`.
- Role guards successfully lock Viewer accounts from creating or editing documents.
- Schema validations map UI inputs accurately with user-friendly error messages.
- Absolutely no direct DML or Supabase table operations.
- The UI does not directly call `tgd_rpc_post_receiving_document`; all invocations utilize the isolated service wrappers.

## Security Readiness
- Anon blocked: Public/Anon execution of RPCs is strictly forbidden (`revoke execute from anon`).
- Staff, Manager, and Admin roles tested natively. Customer profile isolation enforced at the database level.
- Service role usage has been thoroughly removed from the frontend integration footprint.

## Audit/Trace Readiness
- `created_by`, `posted_by`, `posted_at` successfully validated in testing.
- Movements contain proper `source_document_id`, `source_line_id`, and `source_module`.
- Re-running POST correctly fails identically across multiple calls (idempotency passed).

## Known Risks
- Minor risk of concurrent execution bypassing idempotency. `pg_advisory_xact_lock` applied per document to mitigate this.
- Manual balance update temptation: Strict enforcement of no manual stock balance updates minimizes data desynchronization.

## Pre-Production Checklist
- [x] Codebase audited for direct DML patterns.
- [x] Staging tests completed.
- [ ] Database backup executed before deployment.
- [ ] Business sign-off achieved.

## Production Apply Plan Draft
1. Stop all warehouse activities in legacy flows.
2. Execute full database backup.
3. Apply migrations `020` through `024` consecutively.
4. Run basic UI smoke tests under Admin profile.

## Rollback/Stop Conditions
- Any errors during migration application.
- Unhandled HTTP 500 errors from RPC calls.
- Stock movements generated with `quantity = 0` or missing audit trails.

## Go/No-Go Recommendation
**GO**: The application meets structural and security standards for production usage.
