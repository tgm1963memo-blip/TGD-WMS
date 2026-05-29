# Withdrawal Request Foundation

Sprint 3A creates the customer withdrawal request foundation for TGD WMS.

## Outbound Source Model

TGD WMS does not use Sales Order / SO as the outbound source. Outbound work starts when a customer informs the warehouse which products and quantities they want to withdraw from cold storage.

The document name and table names use withdrawal request terminology.

## Withdrawal Request Purpose

`tgd_withdrawal_requests` represents the customer's request to withdraw stock. It records the customer, warehouse, requested dispatch details, delivery details, priority, status, confirmation information, cancellation information, and remarks.

## Customer Request Workflow

The customer request is captured first. Warehouse allocation, picking, and dispatch happen later after confirmation and are intentionally separate foundations.

## Withdrawal Status Workflow

Allowed statuses:

- `DRAFT`
- `CONFIRMED`
- `ALLOCATED`
- `PARTIALLY_ALLOCATED`
- `PICKING`
- `PICKED`
- `DISPATCHED`
- `CANCELLED`
- `CLOSED`

Sprint 3A implements confirmation from `DRAFT` to `CONFIRMED`.

## Withdrawal Type And Priority

Allowed withdrawal types:

- `NORMAL`
- `CUSTOMER_PICKUP`
- `DELIVERY`
- `RETURN_TO_CUSTOMER`
- `SAMPLE`
- `DAMAGE_DISPOSAL`
- `OTHER`

Allowed priorities:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

## Line Quantity Model

`tgd_withdrawal_request_lines` stores requested product, optional requested lot or expiry information, requested quantity, allocation quantity, picked quantity, dispatched quantity, UOM, and notes.

Quantity progression constraints ensure:

- `allocated_qty <= requested_qty`
- `picked_qty <= allocated_qty`
- `dispatched_qty <= picked_qty`

Sprint 3A keeps allocation, picking, and dispatch quantities available for later workflow stages, but does not change them.

## Why Sprint 3A Does Not Allocate Stock

Confirmation only validates that the customer request is usable. It does not reserve stock because allocation requires its own rules for lot selection, FEFO/expiry behavior, location selection, pallet handling, customer isolation, and shortage handling.

Allocation belongs in Sprint 3B Withdrawal Allocation Foundation.

## Confirm Behavior

`tgd_confirm_withdrawal_request(p_withdrawal_request_id uuid, p_confirmed_by uuid default null)`:

- Locks and validates the withdrawal request
- Requires status `DRAFT`
- Rejects requests with no lines
- Rejects lines with `requested_qty <= 0`
- Updates status to `CONFIRMED`
- Sets `confirmed_at` and `confirmed_by`
- Writes an audit log through `tgd_write_audit_log(input jsonb)`
- Returns the confirmed request id and withdrawal number

The confirm function does not call `tgd_post_inventory_movement`, update stock balances, create allocation rows, create picking rows, or create dispatch rows.

## Audit Behavior

Confirmation writes one audit entry for the withdrawal request with action `CONFIRM`. The audit metadata includes withdrawal number, line count, withdrawal type, and priority.

## Intentionally Not Included In Sprint 3A

- Stock allocation
- Picking documents or picking movements
- Dispatch documents
- Movement ledger posting
- Direct stock-balance updates
- Full React withdrawal request UI
- Express DBF sync
- RLS policies for withdrawal request tables

## Next Sprint Recommendation

Sprint 3B Withdrawal Allocation Foundation.

