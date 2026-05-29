# Sprint 2A Implementation Notes

## What Was Created

- `database/migrations/004_receiving_foundation.sql`
- `database/docs/receiving-foundation.md`
- `src/constants/receivingStatus.js`
- `src/services/receivingService.js`
- `tests/unit/receiving-schema.test.js`

## Receiving Tables

- `tgd_receiving_documents`
- `tgd_receiving_lines`

## Posting Function

`tgd_post_receiving_document(p_receiving_document_id uuid, p_posted_by uuid default null)` posts receiving documents by creating inventory movements through `tgd_post_inventory_movement(input jsonb)`.

It does not update `tgd_stock_balances` directly.

## Status Model

Statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Receiving types:

- `NORMAL`
- `RETURN`
- `OPENING_BALANCE`
- `ADJUSTMENT_IN`

Line condition statuses:

- `GOOD`
- `DAMAGED`
- `HOLD`
- `REJECTED`

## Audit Behavior

Posting writes an audit log through `tgd_write_audit_log(input jsonb)` with action `POST`.

## Intentionally Not Created

- No full React receiving UI
- No receiving page business logic
- No picking tables
- No transfer tables
- No dispatch tables
- No Express sync
- No direct stock-balance update logic
- No legacy file changes

## Migration Application Notes

Apply Sprint 1A, 1B, and 1C migrations before `004_receiving_foundation.sql`. The receiving migration depends on master data, movement ledger, stock balance posting, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 2B Putaway.

