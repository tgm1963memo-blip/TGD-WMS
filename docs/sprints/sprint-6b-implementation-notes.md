# Sprint 6B Implementation Notes

## Customer Stock Movement Ledger Scope

Sprint 6B adds a read-only Customer Stock Movement Ledger foundation at `/reports/movement-ledger`.

This report supports cold storage deposit, storage, withdrawal, dispatch / goods issue, operational audit, and monthly customer storage billing preparation. It is not sales analysis.

The report includes:

- report filters
- movement summary cards
- movement type breakdown
- movement ledger table

## Read-Only Query Approach

`movementLedgerReportService.js` reads from `tgd_inventory_movements` using Supabase `select` queries only.

The service does not write data, does not call RPC functions, and does not create movement or workflow actions.

## Filters

The report filter panel supports:

- date from
- date to
- movement type
- product
- customer
- warehouse
- location
- reference type

The service applies these filters where the ledger schema supports them.

## Summary Card Logic

Summary cards are calculated from selected movement rows:

- total movement rows counts rows
- deposit / inbound quantity is based on target-only warehouse movement direction
- withdrawal / outbound quantity is based on source-only warehouse movement direction
- net stock movement is inbound minus outbound
- unique customers, lots, and pallets are distinct IDs in the selected row set

## Movement Type Breakdown Logic

Movement type breakdown groups selected movement rows by `movement_type`, counting rows and summing quantity for each group.

## Movement Table Columns

The ledger table shows:

- movement date
- movement type
- product
- customer
- lot
- source and target warehouse
- source and target location
- source and target pallet
- quantity and UOM
- reference type and ID
- creator

The table is intended to help trace customer-owned stock movement across lot, pallet, and location activity.

## Exclusions

Sprint 6B intentionally does not include:

- movement posting
- workflow posting or confirmation
- stock balance writes
- movement correction actions
- report export implementation
- Express sync
- database migrations
- commercial order terminology
- sales invoice, revenue, margin, order value, or invoice value metrics
- accounting invoice generation
- billing engine implementation

The report prepares read-only operational evidence for monthly customer storage billing support only.

## Next Sprint Recommendation

Sprint 6C should add read-only operational reports for aging, expiry, and customer inventory while keeping export and write actions out of scope.
