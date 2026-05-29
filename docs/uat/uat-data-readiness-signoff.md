# UAT Data Readiness Signoff

## Data Readiness Summary

| Area | Status: Not Prepared / Prepared / Verified | Owner | Evidence / Notes |
|---|---|---|---|
| Master data | Not Prepared | Admin / Warehouse Manager |  |
| Transaction sample data | Not Prepared | Warehouse Manager |  |
| Role accounts | Not Prepared | Admin / Controller |  |
| Reports data | Not Prepared | Warehouse Manager / Accounting |  |
| Accounting review assumptions | Not Prepared | Accounting |  |

## Master Data Readiness

- Customers prepared.
- Products/SKUs prepared.
- Warehouses, rooms, zones, and locations prepared.
- Pallets and lots prepared.
- Opening stock prepared.

Status:

## Transaction Data Readiness

- Receiving samples prepared.
- Putaway samples prepared.
- Transfer samples prepared.
- Adjustment samples prepared.
- Stock count samples prepared.
- Customer Withdrawal samples prepared.
- Allocation, Picking, and Dispatch / Goods Issue samples prepared.

Status:

## Role Readiness

- `admin` account ready.
- `warehouse_manager` account ready.
- `warehouse_staff` account ready.
- `accounting` account ready.
- `viewer` account ready.

Status:

## Report Readiness

- Inventory Dashboard data visible.
- Movement Ledger data visible.
- Customer Storage Balance Report data visible.
- Storage Aging Report data visible.
- Warehouse Operation Performance Report data visible.
- Monthly Storage Billing Summary data visible.
- Accounting Charge Review data visible.

Status:

## Known Data Gaps

| Gap ID | Description | Impact | Owner | Target resolution | Status |
|---|---|---|---|---|---|
| GAP-001 |  |  |  |  |  |

## Risk Assessment

| Risk | Severity | Mitigation | Owner | Status |
|---|---|---|---|---|
| Missing master data blocks UAT flow | High | Prepare and verify master data before execution | Warehouse Manager | Open |
| Missing role account blocks visibility testing | High | Prepare all role accounts before UAT | Admin / Controller | Open |
| Missing billing assumptions blocks accounting review | Medium | Prepare rate and Operation Charge assumptions | Accounting | Open |

## Sign-off Table

| Sign-off role | Name | Decision: Ready / Not Ready / Conditional | Date | Notes |
|---|---|---|---|---|
| Warehouse Manager |  |  |  |  |
| Accounting |  |  |  |  |
| Admin / Controller |  |  |  |  |
| IT / Technical |  |  |  |  |
