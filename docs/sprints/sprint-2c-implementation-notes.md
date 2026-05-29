# Sprint 2C Implementation Notes

## What Was Created

- `database/migrations/006_transfer_foundation.sql`
- `database/docs/transfer-foundation.md`
- `src/constants/transferStatus.js`
- `src/services/transferService.js`
- `tests/unit/transfer-schema.test.js`

## Transfer Tables

- `tgd_transfer_documents`
- `tgd_transfer_lines`

## Posting Function

`tgd_post_transfer_document(p_transfer_document_id uuid, p_posted_by uuid default null)` posts transfer documents by creating `TRANSFER` inventory movements through `tgd_post_inventory_movement(input jsonb)`.

It does not update `tgd_stock_balances` directly.

## Status And Type Model

Statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Transfer types:

- `INTERNAL`
- `ROOM_TRANSFER`
- `PALLET_TRANSFER`
- `LOCATION_TRANSFER`
- `QUALITY_HOLD_TRANSFER`

## Location And Pallet Rule

Transfer rejects lines where source and target are the same location and same pallet. It allows same location with different pallet and same pallet with different location.

## Audit Behavior

Posting writes an audit log through `tgd_write_audit_log(input jsonb)` with action `POST`.

## Intentionally Not Created

- No full React transfer UI
- No transfer page business logic
- No picking tables
- No dispatch tables
- No Express sync
- No direct stock-balance update logic
- No legacy file changes

## Migration Application Notes

Apply Sprint 1A, 1B, 1C, 2A, and 2B migrations before `006_transfer_foundation.sql`. The transfer migration depends on master data, movement ledger, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 2D Adjustment.

