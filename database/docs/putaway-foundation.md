# Putaway Foundation

Sprint 2B creates the putaway document foundation for TGD WMS.

## Putaway Document Purpose

`tgd_putaway_documents` represents the business document for moving received or staged stock from a source location into a final storage location.

Putaway is a business workflow. Inventory stock changes still happen only through the movement ledger.

## Putaway Status Workflow

Allowed statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Sprint 2B posting rejects documents that are already `POSTED`, `CANCELLED`, or `REVERSED`.

## Line Item Model

`tgd_putaway_lines` stores product, lot, source location/pallet, target location/pallet, planned quantity, putaway quantity, UOM, source receiving line, and the resulting movement link.

Posting rejects any line with `putaway_qty <= 0` and rejects lines where the source and target locations are the same.

## Source Receiving Linkage

`source_receiving_line_id` optionally links a putaway line back to `tgd_receiving_lines`. This gives traceability from receiving to putaway without requiring putaway to be generated automatically in Sprint 2B.

## Posting Behavior

`tgd_post_putaway_document(p_putaway_document_id uuid, p_posted_by uuid default null)`:

- Locks and validates the putaway document
- Rejects already posted, cancelled, or reversed documents
- Rejects documents with no lines
- Rejects lines with non-positive putaway quantity
- Rejects lines where source and target locations are the same
- Calls `tgd_post_inventory_movement(input jsonb)` for every line with movement type `PUTAWAY`
- Links each line to the returned `movement_id`
- Updates the document to `POSTED`
- Writes an audit log with `tgd_write_audit_log(input jsonb)`

Stock insufficiency is enforced by the movement engine.

## Movement Linkage

Every posted putaway line stores `movement_id`, linking the business document line to the inventory ledger movement that changed stock.

Stock balance is never updated directly by the putaway function.

## Audit Behavior

Posting writes one audit entry for the putaway document with action `POST`. The audit metadata includes putaway number, line count, and movement type.

## Intentionally Not Included In Sprint 2B

- Full React putaway UI
- Handheld putaway flow
- Automatic putaway task generation
- Putaway reversal workflow
- Picking, transfer, or dispatch document tables
- Express DBF sync
- Direct stock-balance updates
- RLS policies for putaway tables

## Next Sprint Recommendation

Sprint 2C Transfer.

