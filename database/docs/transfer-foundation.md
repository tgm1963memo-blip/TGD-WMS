# Transfer Foundation

Sprint 2C creates the transfer document foundation for TGD WMS.

## Transfer Document Purpose

`tgd_transfer_documents` represents the business document for moving stock between warehouses, rooms, locations, pallets, or quality areas.

Transfer is a business workflow. Inventory stock changes still happen only through the movement ledger.

## Transfer Status Workflow

Allowed statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Sprint 2C posting rejects documents that are already `POSTED`, `CANCELLED`, or `REVERSED`.

## Transfer Type Model

Allowed transfer types:

- `INTERNAL`
- `ROOM_TRANSFER`
- `PALLET_TRANSFER`
- `LOCATION_TRANSFER`
- `QUALITY_HOLD_TRANSFER`

These types classify intent. Stock movement is still posted with movement type `TRANSFER`.

## Line Item Model

`tgd_transfer_lines` stores product, lot, source location/pallet, target location/pallet, planned quantity, transfer quantity, UOM, reason code, and the resulting movement link.

Posting rejects any line with `transfer_qty <= 0`.

## Location And Pallet Transfer Rules

The same source and target identity is rejected:

- Same `from_location_id` and `to_location_id`
- Same `from_pallet_id` and `to_pallet_id`, including both null

Same location with a different pallet can be used for `PALLET_TRANSFER`.

Same pallet with a different location can be used for `LOCATION_TRANSFER`.

## Posting Behavior

`tgd_post_transfer_document(p_transfer_document_id uuid, p_posted_by uuid default null)`:

- Locks and validates the transfer document
- Rejects already posted, cancelled, or reversed documents
- Rejects documents with no lines
- Rejects lines with non-positive transfer quantity
- Rejects lines where source and target are the same location and same pallet
- Calls `tgd_post_inventory_movement(input jsonb)` for every line with movement type `TRANSFER`
- Links each line to the returned `movement_id`
- Updates the document to `POSTED`
- Writes an audit log with `tgd_write_audit_log(input jsonb)`

Stock insufficiency is enforced by the movement engine.

## Movement Linkage

Every posted transfer line stores `movement_id`, linking the business document line to the inventory ledger movement that changed stock.

Stock balance is never updated directly by the transfer function.

## Audit Behavior

Posting writes one audit entry for the transfer document with action `POST`. The audit metadata includes transfer number, line count, movement type, and transfer type.

## Intentionally Not Included In Sprint 2C

- Full React transfer UI
- Handheld transfer flow
- Transfer approval workflow
- Transfer reversal workflow
- Picking or dispatch document tables
- Express DBF sync
- Direct stock-balance updates
- RLS policies for transfer tables

## Next Sprint Recommendation

Sprint 2D Adjustment.

