# UAT Master Data Preparation Checklist

This checklist plans required UAT master data. It does not create seed data.

## Customer Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Customer codes prepared | At least 3 UAT customers | Not Prepared | Admin |  |
| Customer names prepared | Thai/English names if needed | Not Prepared | Admin |  |
| Customer active status checked | Customers usable for UAT | Not Prepared | Admin |  |

## Product / SKU Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Product/SKU codes prepared | At least 3 SKUs | Not Prepared | Warehouse Manager |  |
| UOM prepared | Unit of measure available | Not Prepared | Warehouse Manager |  |
| Weight assumption prepared | Required for billing review samples | Not Prepared | Accounting |  |
| Lot/expiry requirement identified | Required where applicable | Not Prepared | Warehouse Manager |  |

## Warehouse Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Warehouse prepared | Main UAT warehouse | Not Prepared | Warehouse Manager |  |
| Warehouse code/name verified | Matches UAT naming | Not Prepared | Warehouse Manager |  |

## Room Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Frozen room prepared | Room available for Putaway | Not Prepared | Warehouse Manager |  |
| Chilled room prepared | Room available for Transfer/Count | Not Prepared | Warehouse Manager |  |

## Zone Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Storage zone prepared | Zone for normal Putaway | Not Prepared | Warehouse Manager |  |
| Alternate zone prepared | Zone for Transfer/Picking | Not Prepared | Warehouse Manager |  |

## Location Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Receiving target location prepared | Location for received goods | Not Prepared | Warehouse Staff |  |
| Transfer source/target locations prepared | At least 2 locations | Not Prepared | Warehouse Staff |  |
| Picking source location prepared | Location with available stock | Not Prepared | Warehouse Staff |  |

## Pallet Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Receiving pallet prepared | Pallet for Goods Deposit | Not Prepared | Warehouse Staff |  |
| Withdrawal pallet prepared | Pallet for Dispatch / Goods Issue | Not Prepared | Warehouse Staff |  |

## Lot Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Active lot prepared | Lot for normal operation | Not Prepared | Warehouse Staff |  |
| Aging/expiry lot prepared | Lot for Storage Aging Report | Not Prepared | Warehouse Manager |  |

## Opening Stock Setup Checklist

| Item | Expected | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|---|
| Opening stock for reports | Customer-owned inventory visible | Not Prepared | Warehouse Manager |  |
| Opening stock for transfer | Stock in source location | Not Prepared | Warehouse Manager |  |
| Opening stock for withdrawal | Available stock for allocation/picking/dispatch | Not Prepared | Warehouse Manager |  |

## Verification Checklist

| Item | Expected | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|
| Master data pages load | Pages are readable |  |  |
| Customer-owned inventory relationship is clear | Customer, product, lot, pallet, location are traceable |  |  |
| Reports can see prepared master data | Dashboard/report filters show data where applicable |  |  |

## Evidence / Record-keeping

- Screenshot of prepared master data.
- Owner name and timestamp.
- Related UAT scenario ID.
- Reviewer name where warehouse manager/accounting/admin verification is required.
- Notes for missing or corrected data.
