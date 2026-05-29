# Sprint 3A Implementation Notes

## What Was Created

- `database/migrations/008_withdrawal_request_foundation.sql`
- `database/docs/withdrawal-request-foundation.md`
- `src/constants/withdrawalRequestStatus.js`
- `src/services/withdrawalRequestService.js`
- `tests/unit/withdrawal-request-schema.test.js`

## Outbound Source Model

TGD WMS does not use Sales Order / SO as the outbound source. Sprint 3A uses customer withdrawal request terminology throughout the new tables, functions, constants, services, and docs.

## Withdrawal Request Tables

- `tgd_withdrawal_requests`
- `tgd_withdrawal_request_lines`

## Confirm Function

`tgd_confirm_withdrawal_request(p_withdrawal_request_id uuid, p_confirmed_by uuid default null)` confirms a draft withdrawal request.

It validates lines, updates the request to `CONFIRMED`, and writes an audit log. It does not allocate stock and does not post inventory movements.

## Quantity Model

Line quantity constraints enforce:

- `allocated_qty <= requested_qty`
- `picked_qty <= allocated_qty`
- `dispatched_qty <= picked_qty`

These fields support later workflow stages but are not changed by Sprint 3A confirmation.

## Intentionally Not Created

- No allocation tables
- No picking tables
- No dispatch tables
- No movement posting
- No stock-balance updates
- No full React UI
- No Express sync
- No legacy file changes

## Migration Application Notes

Apply previous migrations before `008_withdrawal_request_foundation.sql`. The withdrawal request migration depends on customers, warehouses, products, lots, user profiles, and audit logging.

## Next Sprint Recommendation

Sprint 3B Withdrawal Allocation Foundation.

