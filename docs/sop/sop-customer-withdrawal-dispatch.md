# SOP: Customer Withdrawal To Dispatch / Goods Issue

## Customer Withdrawal Request

Customer withdrawal request records a customer's request to remove goods from cold storage. It is not a Sales Order process.

### Steps

1. Create or open customer withdrawal request.
2. Verify customer, warehouse, withdrawal type, requested dispatch date, and remark.
3. Add requested products, lots, pallets, quantities, and UOM where applicable.
4. Review available customer-owned stock.
5. Submit or confirm only through approved UAT workflow.

## Allocation

1. Select withdrawal request.
2. Allocate available stock by product, lot, pallet, and location.
3. Confirm allocation quantity does not exceed available customer-owned stock.
4. Review allocation detail.

## Picking

1. Create or open picking document from allocation.
2. Pick stock from assigned location/pallet/lot.
3. Record picked quantity.
4. Report shortage, damaged goods, or location mismatch to warehouse manager.
5. Confirm picking only if included in approved UAT workflow.

## Dispatch / Goods Issue

1. Create dispatch / goods issue document.
2. Verify customer, withdrawal request, picking document, warehouse, dispatch type, transport information, and dispatch date.
3. Confirm loaded goods match picked stock.
4. Confirm dispatch only through approved UAT workflow.
5. Issue goods and record any discrepancy.

## Stock Reduction Verification

After approved dispatch / goods issue:

- Open Customer Storage Balance Report.
- Verify stock quantity is reduced.
- Verify product, lot, pallet, and location data where visible.

## Movement Ledger Verification

- Open Movement Ledger Report.
- Filter by dispatch or withdrawal reference.
- Confirm goods issue movement, quantity, customer, product, lot, pallet, and warehouse references.

## Customer-Owned Inventory Control

- Only customer-owned stock for the requesting customer may be allocated and dispatched.
- Do not substitute customer stock without approved exception.
- All discrepancies must be recorded.

## Exception Handling

- Insufficient stock: notify warehouse manager and customer service owner.
- Wrong lot/pallet: stop picking and correct allocation.
- Damaged goods: record evidence and notify warehouse manager.
- Dispatch mismatch: stop goods issue until resolved.

## Roles And Approvals

- `warehouse_staff`: prepares allocation, picking, and dispatch steps where assigned.
- `warehouse_manager`: reviews exceptions and approves operational decisions.
- `accounting`: reviews charge impact where operation charges apply.

## Control Points

- Customer withdrawal request must reference the correct customer-owned inventory.
- Allocation must not exceed available customer-owned stock.
- Picking must match allocated product, lot, pallet, and location.
- Dispatch / Goods Issue must be verified against picked stock before confirmation.
- Stock balance and movement ledger must be reviewed after approved goods issue.

## Evidence / Record-keeping

- Keep withdrawal request, allocation, picking, and dispatch transaction reference numbers.
- Capture screenshot or evidence before allocation and after dispatch / goods issue.
- Record movement ledger reference for goods issue movement.
- Record stock balance evidence showing customer-owned inventory reduction.
- Record operator name, timestamp, and reviewer/approver for exceptions or dispatch discrepancies.
