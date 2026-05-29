# UAT Test Data Requirements

## Customers

- At least 3 active customers.
- Include one high-volume customer for reports.
- Include one customer with multiple products/lots.

## Products / SKUs

- At least 5 SKUs.
- Include different UOM values.
- Include weight assumptions for monthly storage billing preparation.
- Include products with expiry-controlled lots.

## Warehouses, Rooms, Zones, Locations

- At least 1 warehouse.
- At least 2 cold rooms.
- At least 2 zones per room where possible.
- At least 5 locations, including source and target transfer locations.

## Pallets And Lots

- Pallets assigned to customer-owned stock.
- Lots with manufacture/expiry or received dates where available.
- Include near-expiry and expired test lots if safe for UAT data.

## Opening Stock

- Stock by customer, product, lot, pallet, warehouse, and location.
- Enough quantity for transfer, count variance, allocation, picking, and dispatch tests.
- Include stock with multiple locations for the same product.

## Receiving Sample Data

- Goods deposit sample for each main customer.
- Receiving lines with product, lot, pallet, quantity, UOM, and target warehouse.
- Reference numbers for traceability.

## Withdrawal Sample Data

- Customer withdrawal request samples.
- Lines with product, lot, requested quantity, and dispatch date.
- Enough available stock to test allocation and dispatch.

## Billing Rate Assumptions

- Storage rate assumptions by customer or product group.
- Chargeable weight or quantity assumption.
- Operation charge examples:
  - Lifting
  - Repack
  - Sorting
  - Labeling
  - Palletizing
- Validation cases for missing rate and missing weight.

## User Roles For UAT

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

## Thai / English Label Checks

- Reports page labels.
- Accounting review labels.
- Permission/access messages.
- Error boundary fallback labels.
- Production readiness/config labels.
