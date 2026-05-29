# Sprint 6C Implementation Notes

## Report Purpose

Sprint 6C adds the Customer Storage Balance Report UI foundation. The report helps operations and accounting review what customer-owned inventory is currently stored by customer, product, lot, pallet, warehouse, room or zone, and location.

The report supports monthly storage billing preparation by exposing current balance quantities and a placeholder for estimated chargeable quantity or weight.

## Cold Storage Scope

TGD WMS is a cold storage deposit, storage, and customer withdrawal system. Customers deposit goods into cold storage, TGD stores and moves the goods, and dispatch occurs through customer withdrawal and goods issue workflows.

TGD does not sell stored goods. Inventory shown in this report remains customer-owned inventory.

## Read-Only Query Approach

The report uses `customerStorageBalanceReportService.js` for all data access. The service reads from stock balance data with select-only queries and returns plain rows and grouped summaries.

The UI does not write data, update stock, post inventory movement, or call workflow posting functions.

## Summary Card Logic

The report shows:

- total customers
- total products / SKUs
- total lots
- total pallets
- total stock quantity
- total available quantity
- total allocated quantity
- estimated chargeable quantity / weight placeholder

The chargeable quantity / weight value is a placeholder for future billing support and is not a finalized billing calculation.

## Table Columns

The Customer Storage Balance table includes:

- customer
- product
- lot
- pallet
- warehouse
- room / zone
- location
- condition status
- stock quantity
- allocated quantity
- available quantity
- UOM
- storage start date
- last movement date
- billing note placeholder

## Billing Support Boundary

Sprint 6C does not include invoice generation because accounting documents are outside this UI foundation.

Sprint 6C does not include a billing engine because rate cards, billing periods, charge rules, and approval workflow require a later approved scope.

Sprint 6C does not include export file generation because this sprint only creates read-only report screens. Accounting handoff/export preparation belongs to a later billing summary foundation.

## Next Sprint Recommendation

Recommended next sprint: Sprint 6D Storage Aging / Lot / Expiry / Chargeable Days Report.
