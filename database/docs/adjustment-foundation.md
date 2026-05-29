# Adjustment Foundation

Sprint 2D creates the adjustment document foundation for TGD WMS.

## Adjustment Document Purpose

`tgd_adjustment_documents` represents controlled stock correction documents such as stock count gains/losses, damage, expiry, quality hold/release, system correction, and other approved adjustments.

Adjustment is a business workflow. Inventory stock changes still happen only through the movement ledger.

## Adjustment Status Workflow

Allowed statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Sprint 2D posting rejects documents that are already `POSTED`, `CANCELLED`, or `REVERSED`.

## Adjustment Type Model

Allowed adjustment types:

- `STOCK_COUNT_GAIN`
- `STOCK_COUNT_LOSS`
- `DAMAGE`
- `EXPIRED`
- `QUALITY_HOLD`
- `QUALITY_RELEASE`
- `SYSTEM_CORRECTION`
- `OTHER`

Adjustment type classifies the document reason. Line direction determines whether the movement is inbound or outbound.

## IN Vs OUT Behavior

- `IN` creates an `ADJUST_IN` movement and uses the line warehouse/location/pallet as the target.
- `OUT` creates an `ADJUST_OUT` movement and uses the line warehouse/location/pallet as the source.

Negative stock and insufficient available stock are enforced by `tgd_post_inventory_movement(input jsonb)`.

## Line Item Model

`tgd_adjustment_lines` stores product, lot, warehouse, location, pallet, adjustment direction, quantity, UOM, reason code, condition status, movement link, and remarks.

Posting rejects any line with `adjustment_qty <= 0`.

Allowed condition statuses are `GOOD`, `DAMAGED`, `HOLD`, `EXPIRED`, `REJECTED`, `RELEASED`, `UNKNOWN`, or null when not applicable.

## Posting Behavior

`tgd_post_adjustment_document(p_adjustment_document_id uuid, p_posted_by uuid default null)`:

- Locks and validates the adjustment document
- Rejects already posted, cancelled, or reversed documents
- Rejects documents with no lines
- Rejects lines with non-positive adjustment quantity
- Routes `IN` lines to movement type `ADJUST_IN`
- Routes `OUT` lines to movement type `ADJUST_OUT`
- Calls `tgd_post_inventory_movement(input jsonb)` for every line
- Links each line to the returned `movement_id`
- Updates the document to `POSTED`
- Writes an audit log with `tgd_write_audit_log(input jsonb)`

## Movement Linkage

Every posted adjustment line stores `movement_id`, linking the business document line to the inventory ledger movement that changed stock.

## Audit Behavior

Posting writes one audit entry for the adjustment document with action `POST`. The audit metadata includes adjustment number, line count, and adjustment type.

## Stock Safety Rule

Adjustment documents never update `tgd_stock_balances` directly. All stock changes must go through `tgd_post_inventory_movement(input jsonb)` in the same database transaction.

## Intentionally Not Included In Sprint 2D

- Full React adjustment UI
- Handheld adjustment flow
- Adjustment approval workflow
- Adjustment reversal workflow
- Picking or dispatch document tables
- Express DBF sync
- Direct stock-balance updates
- RLS policies for adjustment tables

## Next Sprint Recommendation

Sprint 3A Order Import.

