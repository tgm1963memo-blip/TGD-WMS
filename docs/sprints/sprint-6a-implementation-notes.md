# Sprint 6A Implementation Notes

## Dashboard Scope

Sprint 6A adds a read-only inventory dashboard foundation at `/dashboard/inventory`.

The dashboard includes:

- inventory summary cards
- stock balance table
- low stock section
- expiring lots section
- inventory by warehouse section
- inventory by customer section
- dashboard filters

## Read-Only Query Approach

`inventoryDashboardService.js` uses Supabase `select` queries only. The service does not write data and does not call RPC functions.

The primary source is `tgd_stock_balances`. Expiring lot data is read from `tgd_lots`.

## Summary Card Logic

Summary values are calculated from selected stock balance rows:

- total stock quantity sums `qty_on_hand`
- total allocated quantity sums `qty_allocated`
- available quantity sums `qty_available`
- SKU, lot, and pallet counts are distinct IDs from balance rows

## Stock Balance Table Logic

The stock balance table displays customer, product, lot, warehouse, location, pallet, on-hand quantity, allocated quantity, and available quantity.

Low stock uses the same read-only balance rows with a configurable available quantity threshold.

## Filter Approach

The dashboard uses `DocumentFilterBar` for customer and warehouse filters. Additional filter fields are present as UI foundation for later query expansion.

## Exclusions

Sprint 6A intentionally does not include:

- inventory movement posting
- workflow posting or confirmation
- stock balance writes
- export engine
- Express sync
- database migrations
- commercial order terminology

## Next Sprint Recommendation

Sprint 6B should add read-only movement ledger reporting with date and reference filters, while keeping export and posting actions out of scope.
