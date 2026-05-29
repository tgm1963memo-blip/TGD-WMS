# SOP: Receiving And Putaway

## Receiving Purpose

Receiving records customer goods deposit into TGD cold storage. The purpose is to capture customer-owned inventory accurately before storage.

## Required Documents / Data Before Receiving

- Customer reference or goods deposit document.
- Customer master record.
- Product/SKU master record.
- Lot and pallet information if applicable.
- Quantity, UOM, and weight where available.
- Warehouse and receiving area.

## Step-By-Step Receiving Process

1. Select or create receiving document according to the approved UAT workflow.
2. Enter or verify customer, warehouse, receiving type, reference number, and remark.
3. Add receiving lines for product/SKU, lot, pallet, quantity, and UOM.
4. Verify line data against physical goods and customer document.
5. Confirm receiving only if the approved UAT workflow includes posting/confirmation.
6. Record any discrepancy as an exception.

## Pallet / Lot / Quantity Verification

- Match physical pallet label to system pallet reference.
- Match lot number to customer document and product label.
- Count physical quantity before confirmation.
- Verify UOM and weight assumptions where applicable.

## Barcode / Handheld Assumption

Barcode and handheld foundations may support scan audit and validation. If handheld UI is not enabled in the UAT environment, users should record scan-related findings as future enhancement notes.

## Putaway Process

1. Select received stock or putaway document.
2. Confirm source reference from receiving.
3. Select target warehouse, cold room, zone, and location.
4. Verify location is physically available and appropriate for product condition.
5. Confirm putaway only if the approved UAT workflow includes posting/confirmation.

## Location Confirmation

- Confirm location label.
- Confirm cold room/zone.
- Confirm pallet is placed in the correct location.
- Confirm no location conflict or blocked area.

## Stock Balance Verification

After approved receiving and putaway processing:

- Open Inventory Dashboard or Customer Storage Balance Report.
- Verify customer-owned stock quantity.
- Verify warehouse/location/pallet/lot where visible.

## Movement Ledger Verification

- Open Movement Ledger Report.
- Filter by receiving or putaway reference.
- Confirm movement type, quantity, product, customer, lot, pallet, and location references.

## Exception Handling

- Quantity mismatch: stop confirmation and record discrepancy.
- Wrong customer/product/lot: correct document before confirmation.
- Location unavailable: select alternate approved location.
- Damaged goods: record note and notify warehouse manager.

## Roles And Approvals

- `warehouse_staff`: performs receiving and putaway steps.
- `warehouse_manager`: reviews discrepancies and approves exception handling.
- `accounting`: consults only where charge or customer reference affects billing review.

## Control Points

- Customer, product/SKU, lot, pallet, quantity, and UOM must be verified before receiving confirmation.
- Target cold room/location must be confirmed before putaway confirmation.
- Exceptions must be reviewed by warehouse manager before proceeding.
- Stock balance and movement ledger must be checked after approved receiving and putaway processing.

## Evidence / Record-keeping

- Keep receiving and putaway transaction reference numbers.
- Capture screenshot or evidence before and after receiving and putaway operations.
- Record movement ledger reference for receiving and putaway movements.
- Record stock balance evidence after goods are placed into the target location.
- Record operator name, timestamp, and reviewer/approver if an exception or discrepancy occurs.
