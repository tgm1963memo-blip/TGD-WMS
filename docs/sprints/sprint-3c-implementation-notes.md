# Sprint 3C Implementation Notes

## What Was Created

- `database/migrations/010_picking_foundation.sql`
- `database/docs/picking-foundation.md`
- `src/constants/pickingStatus.js`
- `src/services/pickingService.js`
- `tests/unit/picking-schema.test.js`

## Picking Purpose

Picking records physical warehouse picking against withdrawal requests and allocations.

It does not dispatch stock and does not post inventory movements.

## Database Objects

- `tgd_picking_documents`
- `tgd_picking_lines`
- `tgd_confirm_picking_document(p_picking_document_id uuid, p_completed_by uuid default null)`

## Picking Confirmation

The confirm function validates picked quantities, updates picking line variance, stamps picker details where needed, recalculates withdrawal request line `picked_qty`, updates withdrawal request status to `PICKING` or `PICKED`, and writes an audit log.

## Stock Safety Rule

Sprint 3C does not call `tgd_post_inventory_movement`, does not use `PICK_CONFIRM`, and does not update `tgd_stock_balances`.

## Intentionally Not Created

- No dispatch tables
- No goods issue function
- No `PICK_CONFIRM` movements
- No on-hand stock reduction
- No allocated stock reduction
- No full React UI
- No Express sync
- No outbound order tables
- No Sales Order / SO naming
- No legacy file changes

## Migration Application Notes

Apply previous migrations before `010_picking_foundation.sql`. This migration depends on withdrawal requests, withdrawal allocations, master data, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 3D Dispatch / Goods Issue Foundation.

