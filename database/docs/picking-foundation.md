# Picking Foundation

Sprint 3C creates the picking document foundation for TGD WMS.

## Picking Purpose

Picking is a warehouse operation document. It records physical picking activity against allocated stock for a customer withdrawal request.

TGD WMS does not use Sales Order / SO as the outbound source. Picking is connected to withdrawal requests and allocations.

## Relationship To Withdrawal Request And Allocation

`tgd_picking_documents.withdrawal_request_id` links picking to the customer withdrawal request.

`tgd_picking_documents.allocation_id` optionally links picking to a posted allocation document.

`tgd_picking_lines.withdrawal_request_line_id` links each pick line to the requested product line.

`tgd_picking_lines.allocation_line_id` optionally links each pick line to the allocated stock source.

## Why Sprint 3C Does Not Use PICK_CONFIRM

Sprint 3C confirms physical picking only. It must not dispatch stock, reduce `qty_on_hand`, or reduce `qty_allocated`.

`PICK_CONFIRM` will be used in Sprint 3D Dispatch / Goods Issue, where stock leaves allocated inventory.

## Handheld Scan Readiness

Picking lines include:

- `scan_barcode`
- `scan_confirmed`
- `picker_id`
- `picked_at`

These fields prepare the schema for handheld scan workflows without implementing handheld UI in Sprint 3C.

## Quantity Progression Rule

Picking lines enforce:

- `allocated_qty >= 0`
- `picked_qty >= 0`
- `picked_qty <= allocated_qty`
- `variance_qty = allocated_qty - picked_qty`

After confirmation, withdrawal request line `picked_qty` is recalculated from confirmed picking lines. The function rejects any result where picked quantity exceeds allocated quantity.

## Picking Status Workflow

Allowed picking statuses:

- `DRAFT`
- `RELEASED`
- `IN_PROGRESS`
- `PICKED`
- `CANCELLED`

Confirming a picking document sets it to `PICKED`.

The withdrawal request status becomes:

- `PICKED` when all allocated quantity is picked
- `PICKING` when some but not all allocated quantity is picked

## Audit Behavior

Confirmation writes one audit entry for the picking document with action `CONFIRM_PICKING`.

## Stock Safety Rule

Sprint 3C never calls `tgd_post_inventory_movement`, never uses `PICK_CONFIRM`, and never updates `tgd_stock_balances` directly.

## Intentionally Not Included In Sprint 3C

- Dispatch documents
- Goods issue
- `PICK_CONFIRM` movements
- On-hand stock reduction
- Allocated stock reduction
- Full React picking UI
- Express DBF sync
- Sales Order / SO naming
- RLS policies for picking tables

## Next Sprint Recommendation

Sprint 3D Dispatch / Goods Issue Foundation.

