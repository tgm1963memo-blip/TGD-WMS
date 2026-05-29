# Withdrawal Allocation Foundation

Sprint 3B creates the withdrawal allocation foundation for TGD WMS.

## Allocation Purpose

Allocation reserves stock for a confirmed customer withdrawal request. It decides which lot, location, and pallet will satisfy requested quantities, but it does not pick or dispatch stock.

TGD WMS does not use Sales Order / SO as the outbound source. Allocation is linked to customer withdrawal requests.

## Allocation Is Reservation Only

Allocation creates `PICK_ALLOCATE` inventory movements. This increases `qty_allocated` through the movement engine while leaving `qty_on_hand` unchanged.

Allocation must not create `PICK_CONFIRM` movements and must not reduce stock.

## Relationship To Withdrawal Request

`tgd_withdrawal_allocations.withdrawal_request_id` links an allocation document to a withdrawal request.

`tgd_withdrawal_allocation_lines.withdrawal_request_line_id` links each allocated stock source back to the requested product line.

## PICK_ALLOCATE Behavior

`tgd_post_withdrawal_allocation(p_allocation_id uuid, p_allocated_by uuid default null)` calls `tgd_post_inventory_movement(input jsonb)` for each allocation line with:

- `movement_type = PICK_ALLOCATE`
- `reference_type = WITHDRAWAL_ALLOCATION`
- source warehouse/location/pallet from the allocation line
- quantity from `allocated_qty`

The movement engine rejects insufficient available stock.

## Quantity Progression Rule

After posting, withdrawal request line `allocated_qty` is recalculated from posted allocation lines.

The function rejects any result where:

- `allocated_qty > requested_qty`

The withdrawal request status becomes:

- `ALLOCATED` when all requested quantities are fully allocated
- `PARTIALLY_ALLOCATED` when at least some quantity is allocated but not all requested quantity is covered

## Stock Safety Rule

The allocation post function never updates `tgd_stock_balances` directly. It changes reserved quantity only through `tgd_post_inventory_movement(input jsonb)`.

## Intentionally Not Included In Sprint 3B

- Picking documents
- Dispatch documents
- `PICK_CONFIRM` movements
- On-hand stock reduction
- Full React allocation UI
- Express DBF sync
- Direct stock-balance updates
- Sales Order / SO naming
- RLS policies for allocation tables

## Next Sprint Recommendation

Sprint 3C Picking Foundation.

