# Sprint 3B Implementation Notes

## What Was Created

- `database/migrations/009_withdrawal_allocation_foundation.sql`
- `database/docs/withdrawal-allocation-foundation.md`
- `src/constants/withdrawalAllocationStatus.js`
- `src/services/withdrawalAllocationService.js`
- `tests/unit/withdrawal-allocation-schema.test.js`

## Allocation Purpose

Allocation reserves stock for customer withdrawal requests. It does not pick, confirm, dispatch, or reduce `qty_on_hand`.

## Database Objects

- `tgd_withdrawal_allocations`
- `tgd_withdrawal_allocation_lines`
- `tgd_post_withdrawal_allocation(p_allocation_id uuid, p_allocated_by uuid default null)`

## Movement Behavior

Posting creates `PICK_ALLOCATE` movements through `tgd_post_inventory_movement(input jsonb)`.

The function does not use `PICK_CONFIRM` and does not update `tgd_stock_balances` directly.

## Relationship To Withdrawal Request

Allocation lines reference withdrawal request lines. After posting, withdrawal request line `allocated_qty` is recalculated from posted allocations, and the request status becomes `ALLOCATED` or `PARTIALLY_ALLOCATED`.

## Intentionally Not Created

- No picking tables
- No dispatch tables
- No outbound order tables
- No Sales Order / SO naming
- No `PICK_CONFIRM` movements
- No direct stock-balance updates
- No full React UI
- No Express sync
- No legacy file changes

## Migration Application Notes

Apply previous migrations before `009_withdrawal_allocation_foundation.sql`. This migration depends on withdrawal requests, movement posting, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 3C Picking Foundation.

