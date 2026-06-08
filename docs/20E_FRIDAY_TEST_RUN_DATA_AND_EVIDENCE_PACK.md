# 20E Friday Test Run Data and Evidence Pack

## Phase Status

- 20E is documentation and test-only.
- 20E creates fillable Friday test run data and evidence documents for UAT execution.
- 20E does not execute UAT.
- 20E does not create or fabricate test results.
- 20E does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20E does not touch Production data.
- 20E does not authorize Production release.
- 20E does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Provide fillable master data, sample transaction, report evidence, stock reconciliation, naming standards, and sign-off sections so Friday testers can execute the controlled test run without ambiguity.

## Relationship to 20C and 20D

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` — scope, test data preparation, go/no-go criteria.
- `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` — schedule, assignments, stop rules, end-of-day decision.
- 20E provides the fillable data and evidence capture templates used during Friday execution.
- 20E does not override safety boundaries from 20C or 20D.
- 20E is not FINAL GO.

## Pack Control Information

| Field | Value |
|---|---|
| Test run date | Friday — PENDING CONFIRMATION |
| Test environment | Staging / UAT — PENDING CONFIRMATION |
| Application URL | PENDING CONFIRMATION |
| Data prepared by | PENDING OWNER ASSIGNMENT |
| Evidence owner | PENDING OWNER ASSIGNMENT |
| Pack version | 20E-1 |

---

## Fillable Master Data Section

Complete before 09:30 master data check. Mark each row Verified = YES only after UI confirmation.

### Customer

| Customer ID | Customer Name | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|
| PENDING | UAT-CUST-A | FTR-CUST-001 | FTR-05, FTR-14, FTR-27 | PENDING | Primary inbound customer |
| PENDING | UAT-CUST-B | FTR-CUST-002 | FTR-20, FTR-21, FTR-28 | PENDING | Outbound customer |

### Product

| Product ID | Product Code | Product Name | UOM | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|---|---|
| PENDING | UAT-FROZEN-A | PENDING | PENDING | FTR-SKU-001 | FTR-05, FTR-08, FTR-22 | PENDING | Frozen product |
| PENDING | UAT-CHILLED-B | PENDING | PENDING | FTR-SKU-002 | FTR-10, FTR-18, FTR-24 | PENDING | Chilled product |

### Lot

| Lot No | Product Code | Expiry Date | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|---|
| UAT-LOT-FRESH | UAT-FROZEN-A | PENDING | FTR-LOT-001 | FTR-05, FTR-07, FTR-27 | PENDING | Receiving flow lot |
| UAT-LOT-OUT | UAT-CHILLED-B | PENDING | FTR-LOT-002 | FTR-16, FTR-18, FTR-25 | PENDING | Outbound flow lot |

### Warehouse

| Warehouse ID | Warehouse Code | Warehouse Name | 20C Ref | Verified | Notes |
|---|---|---|---|---|---|
| PENDING | UAT-WH-MAIN | PENDING | FTR-WH-001 | PENDING | Main UAT warehouse |

### Location

| Location ID | Location Code | Location Name | Warehouse | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|---|---|
| PENDING | UAT-LOC-RCV | Receiving staging | UAT-WH-MAIN | FTR-LOC-001 | FTR-05, FTR-22 | PENDING | |
| PENDING | UAT-LOC-A01 | Putaway target A01 | UAT-WH-MAIN | FTR-LOC-002 | FTR-08, FTR-09, FTR-23 | PENDING | |
| PENDING | UAT-LOC-B01 | Transfer target B01 | UAT-WH-MAIN | FTR-LOC-003 | FTR-10, FTR-11 | PENDING | |
| PENDING | UAT-LOC-PICK | Picking source | UAT-WH-MAIN | FTR-LOC-004 | FTR-18, FTR-19, FTR-24 | PENDING | |

### Pallet

| Pallet ID | Pallet Code | Product / Lot | Location | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|---|---|
| PENDING | UAT-PAL-001 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | FTR-PAL-001 | FTR-05, FTR-08, FTR-22 | PENDING | Inbound pallet |
| PENDING | UAT-PAL-002 | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | FTR-PAL-002 | FTR-18, FTR-19, FTR-20 | PENDING | Outbound pallet |

### Barcode Alias

| Barcode Alias | Maps To Entity | Maps To Code | 20C Ref | Used By Scenario | Verified | Notes |
|---|---|---|---|---|---|---|
| UAT-BAR-SKU-001 | Product | UAT-FROZEN-A | FTR-BAR-001 | FTR-22 | PENDING | Product scan |
| UAT-BAR-LOC-A01 | Location | UAT-LOC-A01 | FTR-BAR-002 | FTR-23 | PENDING | Location scan |
| UAT-BAR-PAL-001 | Pallet | UAT-PAL-001 | FTR-BAR-003 | FTR-22, FTR-08 | PENDING | Pallet scan |

### Role / User

| User Account | Role | Display Name | 20C Ref | Used By Scenario | Login Verified | Notes |
|---|---|---|---|---|---|---|
| UAT-ADMIN | Admin | PENDING | FTR-ROLE-001 | FTR-01, FTR-02 | PENDING | Coordinator |
| UAT-WH-MGR | Warehouse Manager | PENDING | FTR-ROLE-002 | FTR-10, FTR-12, FTR-24 | PENDING | Operations oversight |
| UAT-WH-STAFF | Warehouse Staff | PENDING | FTR-ROLE-003 | FTR-05, FTR-08, FTR-22, FTR-23 | PENDING | Day-to-day ops |
| UAT-VIEWER | Viewer | PENDING | FTR-ROLE-004 | FTR-27, FTR-28, FTR-29 | PENDING | Read-only reports |

---

## Sample Transaction Data Section

Fill during Friday execution. Record actual document numbers and quantities as transactions complete.

### Receiving Document

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Document No | UAT-REC-DEP-001 | PENDING | PENDING | PENDING |
| Document ID (system) | PENDING | PENDING | PENDING | PENDING |
| Customer | UAT-CUST-A | PENDING | PENDING | PENDING |
| Status | DRAFT / CONFIRMED | PENDING | PENDING | PENDING |
| Received Date | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-05, FTR-06, FTR-07 | — | PENDING | PENDING |

### Receiving Lines

| Line No | Product Code | Lot No | UOM | Planned Qty | Planned Weight | Actual Qty | Actual Weight | Verified | Evidence File |
|---|---|---|---|---|---|---|---|---|---|
| 1 | UAT-FROZEN-A | UAT-LOT-FRESH | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 2 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

### Putaway Document

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Document No | PENDING | PENDING | PENDING | PENDING |
| Document ID (system) | PENDING | PENDING | PENDING | PENDING |
| Source Receiving Doc | UAT-REC-DEP-001 | PENDING | PENDING | PENDING |
| Target Location | UAT-LOC-A01 | PENDING | PENDING | PENDING |
| Pallet | UAT-PAL-001 | PENDING | PENDING | PENDING |
| Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-08, FTR-09, FTR-23 | — | PENDING | PENDING |

### Transfer Document

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Document No | PENDING | PENDING | PENDING | PENDING |
| Document ID (system) | PENDING | PENDING | PENDING | PENDING |
| Source Location | UAT-LOC-A01 | PENDING | PENDING | PENDING |
| Destination Location | UAT-LOC-B01 | PENDING | PENDING | PENDING |
| Product / Lot | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | PENDING | PENDING |
| Planned Qty | PENDING | PENDING | PENDING | PENDING |
| Actual Qty | PENDING | PENDING | PENDING | PENDING |
| Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-10, FTR-11 | — | PENDING | PENDING |

### Adjustment Document

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Document No (IN) | PENDING | PENDING | PENDING | PENDING |
| Document No (OUT) | PENDING | PENDING | PENDING | PENDING |
| Location | UAT-LOC-B01 | PENDING | PENDING | PENDING |
| Product / Lot | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | PENDING | PENDING |
| Adjustment IN Qty | PENDING | PENDING | PENDING | PENDING |
| Adjustment OUT Qty | PENDING | PENDING | PENDING | PENDING |
| Reason | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-12, FTR-13 | — | PENDING | PENDING |

### Withdrawal Request

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Request No | PENDING | PENDING | PENDING | PENDING |
| Request ID (system) | PENDING | PENDING | PENDING | PENDING |
| Customer | UAT-CUST-B | PENDING | PENDING | PENDING |
| Product / Lot | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | PENDING | PENDING |
| Requested Qty | PENDING | PENDING | PENDING | PENDING |
| Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-14, FTR-15 | — | PENDING | PENDING |

### Allocation

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Allocation No | PENDING | PENDING | PENDING | PENDING |
| Allocation ID (system) | PENDING | PENDING | PENDING | PENDING |
| Withdrawal Request | PENDING | PENDING | PENDING | PENDING |
| Source Location | UAT-LOC-PICK | PENDING | PENDING | PENDING |
| Reserved Qty | PENDING | PENDING | PENDING | PENDING |
| Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-16, FTR-17 | — | PENDING | PENDING |

### Picking

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Pick Document No | PENDING | PENDING | PENDING | PENDING |
| Pick Document ID (system) | PENDING | PENDING | PENDING | PENDING |
| Allocation Ref | PENDING | PENDING | PENDING | PENDING |
| Pallet | UAT-PAL-002 | PENDING | PENDING | PENDING |
| Picked Qty | PENDING | PENDING | PENDING | PENDING |
| Pick Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-18, FTR-19 | — | PENDING | PENDING |

### Dispatch

| Field | Planned Value | Actual Value | Verified | Evidence File |
|---|---|---|---|---|
| Dispatch No | UAT-DSP-001 | PENDING | PENDING | PENDING |
| Dispatch ID (system) | PENDING | PENDING | PENDING | PENDING |
| Customer | UAT-CUST-B | PENDING | PENDING | PENDING |
| Product / Lot | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | PENDING | PENDING |
| Dispatched Qty | PENDING | PENDING | PENDING | PENDING |
| Status | PENDING | PENDING | PENDING | PENDING |
| Scenario ID | FTR-20, FTR-21 | — | PENDING | PENDING |

### Expected Stock Movement Summary

| Step | Location | Product / Lot | Movement Type | Expected Qty Change | Actual Qty Change | Source Document | Verified |
|---|---|---|---|---|---|---|---|
| Opening balance | All | All | — | 0 (baseline) | PENDING | — | PENDING |
| Receiving | UAT-LOC-RCV | UAT-FROZEN-A / UAT-LOT-FRESH | IN | +PENDING | PENDING | UAT-REC-DEP-001 | PENDING |
| Putaway | UAT-LOC-A01 | UAT-FROZEN-A / UAT-LOT-FRESH | IN | +PENDING | PENDING | Putaway doc | PENDING |
| Transfer OUT | UAT-LOC-A01 | UAT-FROZEN-A / UAT-LOT-FRESH | OUT | -PENDING | PENDING | Transfer doc | PENDING |
| Transfer IN | UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | IN | +PENDING | PENDING | Transfer doc | PENDING |
| Adjustment IN | UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | IN | +PENDING | PENDING | Adjustment doc | PENDING |
| Adjustment OUT | UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | OUT | -PENDING | PENDING | Adjustment doc | PENDING |
| Allocation reserve | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | RESERVE | -PENDING available | PENDING | Allocation doc | PENDING |
| Pick confirm | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | PICK | -PENDING | PENDING | Pick doc | PENDING |
| Dispatch | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | OUT | -PENDING | PENDING | UAT-DSP-001 | PENDING |
| Closing balance | All | All | — | Net = sum of above | PENDING | All docs | PENDING |

---

## Report Evidence Section

Complete during 15:00 reports block. Mark PASS only when preview and print both succeed.

### Receiving Information

| Check | Scenario ID | Tester | Date/Time | Document Ref | Result | Evidence File | Defect ID |
|---|---|---|---|---|---|---|---|
| Receiving Information preview result | FTR-27 | PENDING | PENDING | UAT-REC-DEP-001 | PENDING | PENDING | — |
| Receiving Information print result | FTR-27 | PENDING | PENDING | UAT-REC-DEP-001 | PENDING | PENDING | — |

Preview PASS criteria: ReportPreviewModal opens; document title "Receiving Information"; line data visible; A4 layout renders.
Print PASS criteria: Print dialog or print CSS layout renders without error; no missing fields.

### Delivery Slip

| Check | Scenario ID | Tester | Date/Time | Document Ref | Result | Evidence File | Defect ID |
|---|---|---|---|---|---|---|---|
| Delivery Slip preview result | FTR-28 | PENDING | PENDING | UAT-DSP-001 | PENDING | PENDING | — |
| Delivery Slip print result | FTR-28 | PENDING | PENDING | UAT-DSP-001 | PENDING | PENDING | — |

Preview PASS criteria: ReportPreviewModal opens; document title "Delivery Slip"; customer and line data visible.
Print PASS criteria: Print layout renders without error; signature section visible.

### Entry-Delivery Inventory Report

| Check | Scenario ID | Tester | Date/Time | Document Ref | Result | Evidence File | Defect ID |
|---|---|---|---|---|---|---|---|
| Entry-Delivery Inventory Report preview result | FTR-29 | PENDING | PENDING | Movement ledger | PENDING | PENDING | — |
| Entry-Delivery Inventory Report print result | FTR-29 | PENDING | PENDING | Movement ledger | PENDING | PENDING | — |

Preview PASS criteria: ReportPreviewModal opens; document title "Entry-Delivery Inventory Report"; movement rows visible.
Print PASS criteria: Print layout renders without error; date range and totals visible.

---

## Stock Reconciliation Evidence

Complete during 15:30 reconciliation block. Record opening balance before first transaction (08:30).

| Check Point | Location | Product / Lot | Opening Balance | Movement | Closing Balance | Variance | Reconciliation Status | Evidence File |
|---|---|---|---|---|---|---|---|---|
| Opening balance | UAT-LOC-RCV | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | — | PENDING | — | PENDING | PENDING |
| Receiving increase | UAT-LOC-RCV | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | +PENDING | PENDING | PENDING | PENDING | PENDING |
| Putaway location movement | UAT-LOC-A01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | +PENDING | PENDING | PENDING | PENDING | PENDING |
| Transfer movement (OUT) | UAT-LOC-A01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | -PENDING | PENDING | PENDING | PENDING | PENDING |
| Transfer movement (IN) | UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | +PENDING | PENDING | PENDING | PENDING | PENDING |
| Adjustment in/out | UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | +/- PENDING | PENDING | PENDING | PENDING | PENDING |
| Allocation reserved quantity | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | -PENDING reserved | PENDING | PENDING | PENDING | PENDING |
| Picking status | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | -PENDING picked | PENDING | PENDING | PENDING | PENDING |
| Dispatch decrease | UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | -PENDING | PENDING | PENDING | PENDING | PENDING |
| Closing balance | All locations | All products/lots | — | Net sum | PENDING | PENDING | PENDING | PENDING |
| Variance | All | All | — | — | — | PENDING | PENDING | PENDING |
| Reconciliation status | All | All | — | — | — | — | PASS / FAIL / HOLD | PENDING |

### Reconciliation Rule

- Variance must be 0 or fully explained by source documents.
- Unexplained variance = FAIL reconciliation; trigger stop rule from 20D.
- Reconciliation PASS required for Friday end-of-day PASS decision.

---

## Screenshot / Evidence Naming Standard

All evidence files must follow this format:

```
FTR-{scenario}-{module}-{YYYYMMDD}-{tester}.png
```

| Component | Description | Example |
|---|---|---|
| `{scenario}` | FTR scenario ID without prefix dash | `05`, `27`, `29` |
| `{module}` | Short module name, no spaces | `Receiving`, `Putaway`, `Reports` |
| `{YYYYMMDD}` | Execution date | `20260613` |
| `{tester}` | Tester initials or short name | `JS`, `WH-STAFF-01` |

### Examples

| Scenario | Module | Example Filename |
|---|---|---|
| FTR-05 | Receiving | `FTR-05-Receiving-20260613-JS.png` |
| FTR-27 | Reports | `FTR-27-Reports-20260613-AC.png` |
| FTR-29 | Reports | `FTR-29-Reports-20260613-AC.png` |
| FTR-24 | StockBalance | `FTR-24-StockBalance-20260613-WM.png` |

### Evidence File Index

| Evidence File | Scenario ID | Module | Tester | Date | Linked Document | Status |
|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

---

## Defect Reference Standard

All defects logged during Friday execution must use this format:

```
DEF-FTR-{running no}
```

| Component | Description | Example |
|---|---|---|
| `DEF-FTR` | Fixed prefix for Friday test run defects | `DEF-FTR` |
| `{running no}` | Three-digit sequential number starting at 001 | `001`, `002`, `003` |

### Examples

- `DEF-FTR-001` — First defect logged on Friday
- `DEF-FTR-002` — Second defect logged on Friday

### Defect Cross-Reference Index

| Defect ID | Scenario ID | Severity | Module | Issue Summary | Evidence File | Status |
|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | Open |

---

## Sign-Off Section

Complete at end of Friday test run (16:30). Sign-off confirms evidence pack completeness; this is not FINAL GO.

| Role | Name | Date | Scenarios Reviewed | Evidence Complete | Defects Reviewed | Sign-Off | Notes |
|---|---|---|---|---|---|---|---|
| Warehouse tester | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-05 to FTR-23 |
| Operations tester | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-10 to FTR-20 |
| Admin / manager | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-01 to FTR-04, oversight |
| IT / system owner | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | Environment, login, technical |
| Controller reviewer | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | End-of-day decision authority |

### Sign-Off Checklist

| # | Item | Warehouse Tester | Operations Tester | Admin/Manager | IT/System Owner | Controller |
|---|---|---|---|---|---|---|
| 1 | Master data verified | PENDING | PENDING | PENDING | PENDING | PENDING |
| 2 | All transaction documents recorded | PENDING | PENDING | PENDING | — | PENDING |
| 3 | All three reports preview/print verified | PENDING | PENDING | PENDING | PENDING | PENDING |
| 4 | Stock reconciliation completed | PENDING | PENDING | PENDING | — | PENDING |
| 5 | Evidence files named per standard | PENDING | PENDING | PENDING | PENDING | PENDING |
| 6 | Defects logged per standard | PENDING | PENDING | PENDING | PENDING | PENDING |
| 7 | No direct DB edits during UAT | — | — | PENDING | PENDING | PENDING |
| 8 | Production remains HOLD | — | — | PENDING | PENDING | PENDING |

### Pack Completion Statement

| Field | Value |
|---|---|
| Pack completed by | PENDING |
| Completion date | PENDING CONFIRMATION |
| Total scenarios executed | PENDING / 29 |
| Total evidence files captured | PENDING |
| Total defects logged | PENDING |
| Reconciliation status | PENDING |
| End-of-day decision | PASS / PASS WITH WORKAROUND / HOLD / FAIL — PENDING |
| FINAL GO authorized | NO — FINAL GO is NOT AUTHORIZED |

Production remains HOLD. FINAL GO is NOT AUTHORIZED.

## Related Documents

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md`
- `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md`
- `docs/uat/uat-test-data-master-list.md`
- `docs/15S_UAT_DEFECT_AND_ISSUE_LOG.md`
