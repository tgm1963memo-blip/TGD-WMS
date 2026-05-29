# Receiving Foundation

Sprint 2A creates the receiving document foundation for TGD WMS.

## Receiving Document Purpose

`tgd_receiving_documents` represents the business document for inbound stock. It records the customer, warehouse, source reference, supplier information, dates, status, posting user, cancellation information, and remarks.

Receiving is a business workflow. Inventory stock changes still happen only through the movement ledger.

## Receiving Status Workflow

Allowed statuses:

- `DRAFT`
- `CONFIRMED`
- `POSTED`
- `CANCELLED`
- `REVERSED`

Sprint 2A posting accepts documents that are not already `POSTED`, `CANCELLED`, or `REVERSED`. Later UI/workflow sprints can decide whether only `CONFIRMED` documents may be posted.

## Receiving Type Model

Allowed receiving types:

- `NORMAL`: posts `RECEIVE` movements
- `RETURN`: posts `RETURN_IN` movements
- `OPENING_BALANCE`: posts `OPENING_BALANCE` movements
- `ADJUSTMENT_IN`: posts `ADJUST_IN` movements

## Line Item Model

`tgd_receiving_lines` stores product, lot, target location, target pallet, expected quantity, received quantity, UOM, condition status, receiving temperature, and the resulting movement link.

Allowed condition statuses:

- `GOOD`
- `DAMAGED`
- `HOLD`
- `REJECTED`

Posting rejects any line with `received_qty <= 0`.

## Lot Creation And Reuse Rule

If `lot_id` is present, posting uses it.

If `lot_id` is missing and `lot_no` is present, posting looks for an existing `tgd_lots` row for the same product and lot number. If one does not exist, it creates a new lot using the line's manufacturing and expiry dates.

The receiving line is updated with the final `lot_id`.

## Posting Behavior

`tgd_post_receiving_document(p_receiving_document_id uuid, p_posted_by uuid default null)`:

- Locks and validates the receiving document
- Rejects already posted, cancelled, or reversed documents
- Rejects documents with no lines
- Rejects lines with non-positive received quantity
- Creates or reuses lots where needed
- Calls `tgd_post_inventory_movement(input jsonb)` for every line
- Links each line to the returned `movement_id`
- Updates the document to `POSTED`
- Writes an audit log with `tgd_write_audit_log(input jsonb)`

## Movement Linkage

Every posted receiving line stores `movement_id`, linking the business document line to the inventory ledger movement that changed stock.

Stock balance is never updated directly by the receiving function.

## Audit Behavior

Posting writes one audit entry for the receiving document with action `POST`. The audit metadata includes receiving number, line count, and movement type.

## Intentionally Not Included In Sprint 2A

- Full React receiving UI
- Handheld receiving flow
- Receiving approval workflow
- Receiving reversal workflow
- Picking, transfer, dispatch, or adjustment document tables
- Express DBF sync
- Direct stock-balance updates
- RLS policies for receiving tables

## Next Sprint Recommendation

Sprint 2B Putaway.

