# SOP: Master Data

## Purpose

Master data provides the controlled reference data required for cold storage operations and customer-owned inventory reporting.

## Customer Master

1. Open customer master list.
2. Confirm customer code/name is correct.
3. Confirm customer is active for UAT.
4. Confirm customer appears in reports where stock exists.

## Product / SKU Master

1. Open product/SKU master list.
2. Confirm product code, name, UOM, barcode if available, and storage attributes.
3. Confirm weight assumptions are available where needed for billing summary review.
4. Confirm expiry or lot-control requirements with warehouse manager.

## Warehouse / Room / Zone / Location Master

1. Open warehouse and location pages.
2. Confirm warehouse, room, zone, and location hierarchy.
3. Confirm storage locations are active and usable for receiving, putaway, transfer, picking, and reporting.
4. Confirm cold room naming matches physical warehouse labels.

## Pallet Master

1. Confirm pallet IDs or pallet barcodes are available where used.
2. Confirm pallet status is correct.
3. Confirm pallet can be traced to customer-owned inventory.

## Lot Master

1. Confirm lot number is recorded correctly.
2. Confirm received date, manufacture date, expiry date, or other lot dates if available.
3. Confirm lot is linked to correct product and customer stock.

## Master Data Review Checklist

- Customer exists and is active.
- Product/SKU exists with correct UOM.
- Warehouse/room/zone/location exists and matches physical storage.
- Pallet and lot references are available where required.
- Barcode references are available where used.
- Weight or billing assumptions are available for accounting review where required.

## Common Errors

- Wrong customer assigned to stock.
- Product/SKU code mismatch.
- Missing location or inactive location.
- Missing lot or pallet number.
- Incorrect UOM.
- Missing weight assumption for billing review.

## Control Points

- Warehouse manager reviews operational master data before UAT execution.
- Accounting reviews customer and billing-related assumptions.
- Master data corrections must be recorded as UAT findings.

## Evidence / Record-keeping

- Keep master data review reference, reviewer name, and timestamp.
- Capture screenshot or evidence of customer, product/SKU, warehouse, room, zone, location, pallet, and lot records before UAT execution.
- Record correction requests with operator name and reviewer/approver if applicable.
- Keep stock balance evidence when master data is used to validate customer-owned inventory reports.
- Link any master data issue to the related UAT defect or scenario reference.
