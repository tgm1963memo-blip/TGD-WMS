# Dispatch / Goods Issue Foundation

Sprint 3D creates the dispatch and goods issue foundation for TGD WMS.

## Dispatch / Goods Issue Purpose

Dispatch is the real outbound stock issue. It confirms that picked goods leave warehouse stock for a customer withdrawal request.

TGD WMS does not use Sales Order / SO as the outbound source. Dispatch is linked to withdrawal requests, allocations, and picking.

## Relationship To Withdrawal Request, Allocation, And Picking

`tgd_dispatch_documents.withdrawal_request_id` links dispatch to the customer withdrawal request.

`tgd_dispatch_documents.picking_document_id` optionally links dispatch to a picking document.

`tgd_dispatch_lines.withdrawal_request_line_id` links each dispatch line to the requested product line.

`tgd_dispatch_lines.picking_line_id` and `allocation_line_id` trace dispatch back to picking and allocation sources.

## Why PICK_CONFIRM Is Used Here

Allocation reserves stock with allocation movement behavior. Picking records physical picking but does not reduce stock.

Dispatch is where stock is actually issued, so Sprint 3D uses `PICK_CONFIRM`.

## Stock Reduction Through Movement Engine

`tgd_post_dispatch_document(p_dispatch_document_id uuid, p_posted_by uuid default null)` calls `tgd_post_inventory_movement(input jsonb)` for each dispatch line with:

- `movement_type = PICK_CONFIRM`
- `reference_type = DISPATCH`
- source warehouse/location/pallet from the dispatch line
- quantity from `dispatch_qty`

The movement engine reduces both `qty_on_hand` and `qty_allocated`. Dispatch never updates `tgd_stock_balances` directly.

## Dispatch Status Workflow

Allowed dispatch statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Posting sets the dispatch document to `POSTED`.

## Quantity Progression Rule

Dispatch lines enforce:

- `picked_qty >= 0`
- `dispatch_qty >= 0`
- `dispatch_qty <= picked_qty`

After posting, withdrawal request line `dispatched_qty` is recalculated from posted dispatch lines. The function rejects any result where dispatched quantity exceeds picked quantity.

The withdrawal request status becomes:

- `DISPATCHED` when all picked quantity is dispatched
- `PICKED` when picked quantity remains but the request is not fully dispatched

## Audit Behavior

Posting writes one audit entry for the dispatch document with action `POST`.

## Stock Safety Rule

Dispatch must use `tgd_post_inventory_movement(input jsonb)` and must never update `tgd_stock_balances` directly.

## Intentionally Not Included In Sprint 3D

- Invoice tables
- Delivery billing logic
- Full React dispatch UI
- Express DBF sync
- Sales Order / SO naming
- Outbound order tables
- RLS policies for dispatch tables

## Next Sprint Recommendation

Phase 4 Sprint 4A Barcode Scan Service, or a hardening sprint for outbound reversal and RLS policies before handheld workflows.

