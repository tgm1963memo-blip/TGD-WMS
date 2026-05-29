# UAT Test Data Master List

This document is a planning list only. It does not insert data into the database and does not create seed scripts.

## Customers

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| CUST-001 | UAT-CUST-A | Primary cold storage customer | Master Data / Receiving / Reports | UAT-MD-001, UAT-REC-001, UAT-REP-003 | Admin / Warehouse Manager | Not Prepared |  |
| CUST-002 | UAT-CUST-B | Customer with multiple products/lots | Receiving / Customer Withdrawal | UAT-WDR-001, UAT-ALL-001 | Admin / Warehouse Manager | Not Prepared |  |
| CUST-003 | UAT-CUST-ACCOUNTING | Customer for billing review | Monthly Storage Billing Summary | UAT-BIL-001, UAT-BIL-002 | Accounting | Not Prepared |  |

## Products / SKUs

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| SKU-001 | UAT-FROZEN-A | Frozen product with lot tracking | Receiving / Putaway / Reports | UAT-REC-001, UAT-PUT-001 | Warehouse Manager | Not Prepared |  |
| SKU-002 | UAT-CHILLED-B | Chilled product for transfer | Transfer / Stock Count | UAT-TRF-001, UAT-STC-001 | Warehouse Manager | Not Prepared |  |
| SKU-003 | UAT-BILLING-C | Product with weight assumption | Billing Review | UAT-BIL-001 | Accounting | Not Prepared |  |

## Warehouses

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| WH-001 | UAT-WH-MAIN | Main UAT warehouse | All warehouse operations | All operation scenarios | Warehouse Manager | Not Prepared |  |

## Rooms

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| ROOM-001 | UAT-FROZEN-ROOM | Frozen room | Putaway / Reports | UAT-PUT-001, UAT-REP-004 | Warehouse Manager | Not Prepared |  |
| ROOM-002 | UAT-CHILLED-ROOM | Chilled room | Transfer / Stock Count | UAT-TRF-001, UAT-STC-001 | Warehouse Manager | Not Prepared |  |

## Zones

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| ZONE-001 | UAT-ZONE-A | Standard storage zone | Putaway / Transfer | UAT-PUT-001, UAT-TRF-001 | Warehouse Manager | Not Prepared |  |
| ZONE-002 | UAT-ZONE-B | Alternate storage zone | Transfer / Picking | UAT-TRF-002, UAT-PIC-001 | Warehouse Manager | Not Prepared |  |

## Locations

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| LOC-001 | UAT-LOC-A01 | Receiving putaway target | Receiving / Putaway | UAT-PUT-001 | Warehouse Staff | Not Prepared |  |
| LOC-002 | UAT-LOC-B01 | Transfer target | Transfer | UAT-TRF-001 | Warehouse Staff | Not Prepared |  |
| LOC-003 | UAT-LOC-PICK | Picking source | Picking / Dispatch | UAT-PIC-001, UAT-DSP-001 | Warehouse Staff | Not Prepared |  |

## Pallets

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| PAL-001 | UAT-PAL-001 | Pallet for received goods | Receiving / Putaway | UAT-REC-001, UAT-PUT-001 | Warehouse Staff | Not Prepared |  |
| PAL-002 | UAT-PAL-002 | Pallet for withdrawal | Allocation / Picking / Dispatch | UAT-ALL-001, UAT-PIC-001, UAT-DSP-001 | Warehouse Staff | Not Prepared |  |

## Lots

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| LOT-001 | UAT-LOT-FRESH | Normal active lot | Receiving / Reports | UAT-REC-001, UAT-REP-003 | Warehouse Staff | Not Prepared |  |
| LOT-002 | UAT-LOT-AGING | Aging/expiry review lot | Storage Aging Report | UAT-REP-004 | Warehouse Manager | Not Prepared |  |

## Opening Stock

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| OPEN-001 | Opening stock for CUST-A/SKU-001 | Stock for transfer and reporting | Transfer / Reports | UAT-TRF-001, UAT-REP-003 | Warehouse Manager | Not Prepared |  |
| OPEN-002 | Opening stock for withdrawal | Stock for allocation/picking/dispatch | Customer Withdrawal / Dispatch | UAT-WDR-001, UAT-DSP-002 | Warehouse Manager | Not Prepared |  |

## Receiving Sample Transactions

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| REC-TXN-001 | UAT-REC-DEP-001 | Goods Deposit receiving sample | Receiving / Putaway | UAT-REC-001, UAT-PUT-001 | Warehouse Staff | Not Prepared |  |

## Transfer Sample Transactions

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| TRF-TXN-001 | UAT-TRF-001 | Location-to-location transfer | Transfer | UAT-TRF-001, UAT-TRF-002 | Warehouse Staff | Not Prepared |  |

## Adjustment Sample Transactions

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| ADJ-TXN-001 | UAT-ADJ-IN-001 | Positive adjustment sample | Adjustment | UAT-ADJ-001 | Warehouse Manager | Not Prepared |  |
| ADJ-TXN-002 | UAT-ADJ-OUT-001 | Negative adjustment sample | Adjustment | UAT-ADJ-002 | Warehouse Manager | Not Prepared |  |

## Stock Count Sample Cases

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| STC-CASE-001 | UAT-STC-MATCH | Count case with no variance | Stock Count | UAT-STC-001, UAT-STC-002 | Warehouse Manager | Not Prepared |  |
| STC-CASE-002 | UAT-STC-VARIANCE | Count case with variance | Stock Count / Adjustment | UAT-STC-003 | Warehouse Manager | Not Prepared |  |

## Customer Withdrawal Sample Requests

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| WDR-TXN-001 | UAT-WDR-001 | Customer Withdrawal request sample | Withdrawal / Allocation / Picking / Dispatch | UAT-WDR-001, UAT-ALL-001, UAT-PIC-001, UAT-DSP-001 | Warehouse Staff | Not Prepared |  |

## Billing Rate Assumptions

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| RATE-001 | UAT-STORAGE-RATE-A | Storage rate assumption | Monthly Storage Billing Summary | UAT-BIL-001 | Accounting | Not Prepared |  |
| RATE-002 | UAT-WEIGHT-BASIS | Weight basis assumption | Monthly Storage Billing Summary | UAT-BIL-001 | Accounting | Not Prepared |  |

## Operation Charge Assumptions

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| OCHG-001 | UAT-LIFTING | Lifting charge assumption | Accounting Charge Review | UAT-BIL-002 | Accounting | Not Prepared |  |
| OCHG-002 | UAT-REPACK | Repack charge assumption | Accounting Charge Review | UAT-BIL-002 | Accounting | Not Prepared |  |
| OCHG-003 | UAT-SORTING | Sorting charge assumption | Accounting Charge Review | UAT-BIL-002 | Accounting | Not Prepared |  |

## User Role Accounts

| Test data ID | Name / code | Description | Related module | Required for scenario ID | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|---|---|---|
| ROLE-001 | UAT-ADMIN | Admin/controller user | Role Permission / Navigation | UAT-RPN-001 | Admin | Not Prepared |  |
| ROLE-002 | UAT-WH-MGR | Warehouse manager user | Warehouse operations | UAT-TRF-001, UAT-STC-001 | Admin | Not Prepared |  |
| ROLE-003 | UAT-WH-STAFF | Warehouse staff user | Warehouse operations | UAT-REC-001, UAT-WDR-001 | Admin | Not Prepared |  |
| ROLE-004 | UAT-ACCOUNTING | Accounting user | Accounting Charge Review | UAT-BIL-001, UAT-RPN-003 | Admin | Not Prepared |  |
| ROLE-005 | UAT-VIEWER | Viewer user | Read-only reports | UAT-REP-001, UAT-RPN-002 | Admin | Not Prepared |  |
