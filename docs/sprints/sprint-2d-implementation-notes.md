# Sprint 2D Implementation Notes

## What Was Created

- `database/migrations/007_adjustment_foundation.sql`
- `database/docs/adjustment-foundation.md`
- `src/constants/adjustmentStatus.js`
- `src/services/adjustmentService.js`
- `tests/unit/adjustment-schema.test.js`

## Adjustment Tables

- `tgd_adjustment_documents`
- `tgd_adjustment_lines`

## Posting Function

`tgd_post_adjustment_document(p_adjustment_document_id uuid, p_posted_by uuid default null)` posts adjustment documents by creating `ADJUST_IN` or `ADJUST_OUT` inventory movements through `tgd_post_inventory_movement(input jsonb)`.

It does not update `tgd_stock_balances` directly.

## Status, Type, And Direction Model

Statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Adjustment types:

- `STOCK_COUNT_GAIN`
- `STOCK_COUNT_LOSS`
- `DAMAGE`
- `EXPIRED`
- `QUALITY_HOLD`
- `QUALITY_RELEASE`
- `SYSTEM_CORRECTION`
- `OTHER`

Directions:

- `IN`
- `OUT`

## Audit Behavior

Posting writes an audit log through `tgd_write_audit_log(input jsonb)` with action `POST`.

## Stock Safety Rule

The adjustment post function only changes stock by calling `tgd_post_inventory_movement`. Negative stock and insufficient available stock are handled by the movement engine.

## Intentionally Not Created

- No full React adjustment UI
- No adjustment page business logic
- No picking tables
- No dispatch tables
- No Express sync
- No direct stock-balance update logic
- No legacy file changes

## Migration Application Notes

Apply Sprint 1A, 1B, 1C, 2A, 2B, and 2C migrations before `007_adjustment_foundation.sql`. The adjustment migration depends on master data, movement ledger, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 3A Order Import.

