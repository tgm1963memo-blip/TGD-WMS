# Sprint 6D Implementation Notes

## Report Purpose

Sprint 6D adds the Storage Aging / Lot / Expiry / Chargeable Days Report foundation. The report supports warehouse operations, customer stock monitoring, expiry monitoring, and monthly storage billing preparation.

The report answers which customer-owned lots are in storage, how long they have been stored, where they are stored, which lots are near expiry or expired, and which stock may be chargeable based on storage duration.

## Cold Storage Business Scope

TGD WMS is a cold storage deposit, storage, and customer withdrawal system. Customers deposit goods into cold storage and TGD manages customer-owned inventory through receiving, storage, internal movement, count, withdrawal, and dispatch / goods issue.

TGD does not sell stored goods, and this report is not commercial order analysis.

## Customer-Owned Inventory Rule

All stock in the report is treated as customer-owned inventory. The report must not change stock ownership, reserve stock, post stock movement, or create adjustment actions.

## Aging Bucket Logic

The service classifies aging days into:

- `0_30`
- `31_60`
- `61_90`
- `OVER_90`

If exact `storage_start_date` is not available in the current balance row, the service uses available received or created date fields as a fallback. This is a reporting approximation until a dedicated storage snapshot or storage start field is approved.

## Expiry Status Logic

The service classifies expiry status as:

- `NO_EXPIRY_DATE`
- `OK`
- `NEAR_EXPIRY`
- `EXPIRED`

Near expiry means the expiry date is within 30 days of the report as-of date.

## Chargeable Days Preview Boundary

Chargeable days are a preview field for monthly storage billing preparation. They are not final billing results and do not apply customer rate cards or billing approval rules.

## Read-Only Query Approach

`storageAgingReportService.js` uses select-only access to stock balance data and computes aging, expiry, and chargeable-day preview fields in memory.

The service does not write data, call RPC functions, update stock balances, or post inventory movements.

## Service Usage

`StorageAgingReportPage.jsx` calls:

- `getStorageAgingRows`
- `getStorageAgingSummary`
- `getExpiryAlertRows`
- `groupAgingByCustomer`
- `groupAgingByWarehouse`

The page renders report data only and does not include operational action buttons.

## Summary Card Logic

The report shows:

- total lots
- total pallets
- total customers
- total stock quantity
- aging 0-30 days
- aging 31-60 days
- aging 61-90 days
- aging over 90 days
- near expiry lots
- expired lots
- estimated chargeable days placeholder

## Table Columns

The storage aging table includes:

- customer
- product
- lot
- pallet
- warehouse
- room / zone
- location
- condition status
- stock quantity
- UOM
- storage start or received date
- aging days
- aging bucket
- expiry date
- expiry status
- chargeable days placeholder
- billing note placeholder

## Billing Support Boundary

Sprint 6D does not include invoice generation because accounting documents are outside the report foundation.

Sprint 6D does not include a billing engine because rate cards, billing periods, charge rules, approval workflow, and accounting handoff require a later approved scope.

Sprint 6D does not include export file generation because this sprint only creates read-only report screens.

Sprint 6D does not include expiry write-off, stock hold, or stock release actions because those are stock control workflows requiring separate approval, audit, and posting rules.

## Next Sprint Recommendation

Recommended next sprint: Sprint 6E Warehouse Operation Performance Report.
