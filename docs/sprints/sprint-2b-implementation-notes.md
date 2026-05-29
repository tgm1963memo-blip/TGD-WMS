# Sprint 2B Implementation Notes

## What Was Created

- `database/migrations/005_putaway_foundation.sql`
- `database/docs/putaway-foundation.md`
- `src/constants/putawayStatus.js`
- `src/services/putawayService.js`
- `tests/unit/putaway-schema.test.js`

## Putaway Tables

- `tgd_putaway_documents`
- `tgd_putaway_lines`

## Posting Function

`tgd_post_putaway_document(p_putaway_document_id uuid, p_posted_by uuid default null)` posts putaway documents by creating `PUTAWAY` inventory movements through `tgd_post_inventory_movement(input jsonb)`.

It does not update `tgd_stock_balances` directly.

## Status Model

Statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Postable statuses are represented in code as `DRAFT` and `CONFIRMED`.

## Source Receiving Linkage

`tgd_putaway_lines.source_receiving_line_id` can link a putaway line to a receiving line for traceability.

## Audit Behavior

Posting writes an audit log through `tgd_write_audit_log(input jsonb)` with action `POST`.

## Intentionally Not Created

- No full React putaway UI
- No putaway page business logic
- No picking tables
- No transfer tables
- No dispatch tables
- No Express sync
- No direct stock-balance update logic
- No legacy file changes

## Migration Application Notes

Apply Sprint 1A, 1B, 1C, and 2A migrations before `005_putaway_foundation.sql`. The putaway migration depends on master data, movement ledger, user profiles, audit logging, and receiving line linkage.

## Next Sprint Recommendation

Sprint 2C Transfer.

