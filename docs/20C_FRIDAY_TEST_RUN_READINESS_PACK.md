# 20C Friday Test Run Readiness Pack

## Phase Status

- 20C is documentation and test-only.
- 20C prepares TGD WMS for a controlled Friday test run.
- 20C does not execute UAT.
- 20C does not create or fabricate test results.
- 20C does not modify migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20C does not touch Production data.
- 20C does not add new business features.
- 20C does not authorize Production release.
- 20C does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Prepare TGD WMS for a controlled Friday test run so business users can verify end-to-end warehouse operations, operational reports, and stock balance reconciliation in a non-Production environment with clear evidence, defect logging, and go/no-go criteria.

## Friday Test Run Control Information

| Field | Value |
|---|---|
| Test run date | Friday — PENDING CONFIRMATION |
| Test environment | Staging / UAT — PENDING CONFIRMATION |
| Application URL | PENDING CONFIRMATION |
| Test data owner | PENDING OWNER ASSIGNMENT |
| UAT coordinator | PENDING OWNER ASSIGNMENT |
| Technical support | PENDING OWNER ASSIGNMENT |
| Evidence owner | PENDING OWNER ASSIGNMENT |
| Defect coordinator | PENDING OWNER ASSIGNMENT |
| Controller reviewer | PENDING OWNER ASSIGNMENT |
| Cutoff for result submission | PENDING CONFIRMATION |

## Pre-Run Checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Staging/UAT environment reachable | Technical support | PENDING |
| 2 | All required test data prepared and verified | Test data owner | PENDING |
| 3 | User role accounts created and login tested | Admin | PENDING |
| 4 | Barcode aliases mapped to test products/locations/pallets | Warehouse staff | PENDING |
| 5 | Sample receiving document available | Warehouse staff | PENDING |
| 6 | Sample dispatch document available | Warehouse staff | PENDING |
| 7 | Stock balance baseline recorded before test run | Warehouse manager | PENDING |
| 8 | Operational report preview/print verified in UI | UAT coordinator | PENDING |
| 9 | Evidence folder and naming convention ready | Evidence owner | PENDING |
| 10 | Defect log template distributed | Defect coordinator | PENDING |
| 11 | Production HOLD badge visible in UI | Controller reviewer | PENDING |
| 12 | No direct database edits planned during UAT | Controller reviewer | PENDING |

## Test Run Scope

Execute and record evidence for each scenario below. Mark each as PASS, FAIL, BLOCKED, or HOLD.

### Login / Role

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-01 | Login / Role | `/login` | Login with assigned role account | User lands on dashboard with correct role permissions |
| FTR-02 | Login / Role | Sidebar navigation | Role-based menu visibility | Authorized modules visible; unauthorized modules hidden or blocked |

### Master Data

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-03 | Master Data | `/master-data` | Customer, product, lot, warehouse, location visibility | Required test records visible and searchable |
| FTR-04 | Master Data | Master data detail views | Pallet and barcode alias linkage | Pallet and barcode alias resolve to correct product/lot |

### Receiving

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-05 | Receiving | `/operations/receiving` | Receiving list and document detail | Sample receiving document visible with correct status and lines |
| FTR-06 | Receiving | `/operations/receiving/:id` | Receiving Information report preview/print | Report preview opens; print layout renders without error |
| FTR-07 | Receiving | `/operations/receiving/create` | Draft receiving creation (if authorized) | Draft saved with correct customer, product, lot, quantity |

### Putaway

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-08 | Putaway | `/operations/putaway` | Putaway list and document detail | Putaway document linked to receiving; location assigned |
| FTR-09 | Putaway | `/operations/putaway/:id` | Putaway confirmation flow | Putaway status updates; stock balance reflects putaway |

### Transfer

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-10 | Transfer | `/operations/transfer` | Transfer list and document detail | Transfer record shows source and destination locations |
| FTR-11 | Transfer | `/operations/transfer/:id` | Transfer completion | Source location decreases; destination location increases |

### Adjustment

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-12 | Adjustment | `/operations/adjustment` | Adjustment list and document detail | Positive and negative adjustment documents visible |
| FTR-13 | Adjustment | `/operations/adjustment/:id` | Adjustment posting | Stock balance changes match adjustment quantity; audit trail present |

### Withdrawal Request

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-14 | Withdrawal Request | `/operations/withdrawal-requests` | Withdrawal request list and detail | Sample withdrawal request visible with customer and lines |
| FTR-15 | Withdrawal Request | `/operations/withdrawal-requests/:id` | Request status workflow | Request progresses through expected status states |

### Allocation

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-16 | Allocation | `/operations/allocations` | Allocation list and detail | Stock allocated to withdrawal request lines |
| FTR-17 | Allocation | `/operations/allocations/:id` | Allocation confirmation | Reserved quantity matches available stock at location |

### Picking

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-18 | Picking | `/operations/picking` | Picking list and document detail | Pick list generated from allocation |
| FTR-19 | Picking | `/operations/picking/:id` | Pick confirmation | Picked quantity recorded; reservation status updated |

### Dispatch

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-20 | Dispatch | `/operations/dispatch` | Dispatch list and document detail | Sample dispatch document visible |
| FTR-21 | Dispatch | `/operations/outbound` | Delivery Slip report preview/print | Delivery Slip preview opens; print layout renders without error |

### Barcode Receiving / Putaway

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-22 | Barcode Receiving | Handheld / barcode receiving flow | Scan product or pallet barcode during receiving | Scanned barcode resolves to correct product/lot; line captured |
| FTR-23 | Barcode Putaway | Handheld / barcode putaway flow | Scan location barcode during putaway | Scanned location resolves correctly; putaway target confirmed |

### Stock Balance

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-24 | Stock Balance | `/inventory` or stock balance view | Location-level stock after receiving/putaway | Balance matches expected quantity after inbound flow |
| FTR-25 | Stock Balance | Stock balance view after outbound flow | Balance after allocation/pick/dispatch | Balance decreases correctly; no unexplained variance |
| FTR-26 | Stock Balance | Movement ledger / traceability | Last movement traceability | Each balance change traceable to source document |

### Operational Reports

| Scenario ID | Module | UI Route / Entry | Verification Focus | Expected Result |
|---|---|---|---|---|
| FTR-27 | Receiving Information Report | `/operations/receiving/:id` → Preview / Print | Receiving Information report | Preview modal opens; A4 layout; print action available |
| FTR-28 | Delivery Slip Report | `/operations/outbound` → Preview / Print | Delivery Slip report | Preview modal opens; A4 layout; print action available |
| FTR-29 | Entry-Delivery Inventory Report | `/reports/movement-ledger` → Preview / Print | Entry-Delivery Inventory Report | Preview modal opens; A4 layout; print action available |

## Required Test Data

Prepare and verify all records below before Friday. Status: Not Prepared / Prepared / Verified.

### Customer

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-CUST-001 | UAT-CUST-A | Primary cold storage customer | FTR-05, FTR-14, FTR-27 | Admin | Not Prepared |
| FTR-CUST-002 | UAT-CUST-B | Secondary customer for outbound | FTR-20, FTR-21, FTR-28 | Admin | Not Prepared |

### Product

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-SKU-001 | UAT-FROZEN-A | Frozen product with lot tracking | FTR-05, FTR-08, FTR-22 | Warehouse Manager | Not Prepared |
| FTR-SKU-002 | UAT-CHILLED-B | Chilled product for transfer/outbound | FTR-10, FTR-18, FTR-24 | Warehouse Manager | Not Prepared |

### Lot

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-LOT-001 | UAT-LOT-FRESH | Active lot for receiving flow | FTR-05, FTR-07, FTR-27 | Warehouse Staff | Not Prepared |
| FTR-LOT-002 | UAT-LOT-OUT | Lot for outbound/allocation flow | FTR-16, FTR-18, FTR-25 | Warehouse Staff | Not Prepared |

### Warehouse

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-WH-001 | UAT-WH-MAIN | Main UAT warehouse | All operation scenarios | Warehouse Manager | Not Prepared |

### Location

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-LOC-001 | UAT-LOC-RCV | Receiving staging location | FTR-05, FTR-22 | Warehouse Staff | Not Prepared |
| FTR-LOC-002 | UAT-LOC-A01 | Putaway target location | FTR-08, FTR-09, FTR-23 | Warehouse Staff | Not Prepared |
| FTR-LOC-003 | UAT-LOC-B01 | Transfer destination | FTR-10, FTR-11 | Warehouse Staff | Not Prepared |
| FTR-LOC-004 | UAT-LOC-PICK | Picking source location | FTR-18, FTR-19, FTR-24 | Warehouse Staff | Not Prepared |

### Pallet

| Test Data ID | Code / Name | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-PAL-001 | UAT-PAL-001 | Pallet for received goods | FTR-05, FTR-08, FTR-22 | Warehouse Staff | Not Prepared |
| FTR-PAL-002 | UAT-PAL-002 | Pallet for outbound picking | FTR-18, FTR-19, FTR-20 | Warehouse Staff | Not Prepared |

### User Roles

| Test Data ID | Account / Role | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|
| FTR-ROLE-001 | UAT-ADMIN / Admin | Full access for coordination | FTR-01, FTR-02 | Admin | Not Prepared |
| FTR-ROLE-002 | UAT-WH-MGR / Warehouse Manager | Operations oversight | FTR-10, FTR-12, FTR-24 | Admin | Not Prepared |
| FTR-ROLE-003 | UAT-WH-STAFF / Warehouse Staff | Day-to-day operations | FTR-05, FTR-08, FTR-22, FTR-23 | Admin | Not Prepared |
| FTR-ROLE-004 | UAT-VIEWER / Viewer | Read-only reports | FTR-27, FTR-28, FTR-29 | Admin | Not Prepared |

### Barcode Aliases

| Test Data ID | Barcode Value | Maps To | Description | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|---|
| FTR-BAR-001 | UAT-BAR-SKU-001 | FTR-SKU-001 | Product barcode alias | FTR-22 | Warehouse Staff | Not Prepared |
| FTR-BAR-002 | UAT-BAR-LOC-A01 | FTR-LOC-002 | Location barcode alias | FTR-23 | Warehouse Staff | Not Prepared |
| FTR-BAR-003 | UAT-BAR-PAL-001 | FTR-PAL-001 | Pallet barcode alias | FTR-22, FTR-08 | Warehouse Staff | Not Prepared |

### Sample Receiving Document

| Test Data ID | Document No | Customer | Product / Lot | Quantity | Status | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| FTR-REC-001 | UAT-REC-DEP-001 | FTR-CUST-001 | FTR-SKU-001 / FTR-LOT-001 | PENDING CONFIRMATION | DRAFT or CONFIRMED | FTR-05, FTR-06, FTR-27 | Warehouse Staff | Not Prepared |

### Sample Dispatch Document

| Test Data ID | Document No | Customer | Product / Lot | Quantity | Status | Used By Scenario | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| FTR-DSP-001 | UAT-DSP-001 | FTR-CUST-002 | FTR-SKU-002 / FTR-LOT-002 | PENDING CONFIRMATION | DRAFT or PICKED | FTR-20, FTR-21, FTR-28 | Warehouse Staff | Not Prepared |

## Pass / Fail Evidence Format

Record one evidence row per scenario execution. Do not mark PASS without evidence.

| Field | Description | Required |
|---|---|---|
| Scenario ID | FTR-XX identifier from test run scope | Yes |
| Tester | Name of person executing the scenario | Yes |
| Date/Time | Execution timestamp (local time) | Yes |
| Input Document | Document number, barcode, or data reference used | Yes |
| Expected Result | What should happen per scenario definition | Yes |
| Actual Result | What actually happened | Yes |
| Screenshot/Evidence | File name or link to screenshot, export, or log | Yes |
| Defect ID | Reference to defect log entry if FAIL or BLOCKED | If applicable |
| Status | PASS / FAIL / BLOCKED / HOLD | Yes |

### Evidence Naming Convention

```
FTR-[ScenarioID]_[Module]_[YYYYMMDD]_[ShortDescription]
```

Example: `FTR-06_Receiving_20260613_ReceivingInformationPreview.png`

### Evidence Recording Template

| Scenario ID | Tester | Date/Time | Input Document | Expected Result | Actual Result | Screenshot/Evidence | Defect ID | Status |
|---|---|---|---|---|---|---|---|---|
| FTR-01 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |
| FTR-02 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## Defect Severity

| Severity | Definition | Friday Impact |
|---|---|---|
| Critical | Blocks test run continuation; data integrity risk; wrong stock movement; security breach; cannot login | Blocks Friday go/no-go approval |
| High | Major function broken; no acceptable workaround; blocks scenario completion | Must have documented workaround to proceed |
| Medium | Function impaired but workaround exists; cosmetic issue affecting workflow | Log and continue; fix before Production |
| Low | Minor UI/text issue; no workflow impact | Log and continue |

### Defect Log Template

| Defect ID | Scenario ID | Severity | Description | Expected Result | Actual Result | Evidence Reference | Owner | Workaround | Status | Retest Required | Retest Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PENDING | PENDING | Critical / High / Medium / Low | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | Open | PENDING | PENDING |

## Friday Go / No-Go Rules

Friday test run may proceed to **GO** only when all conditions below are met:

| # | Rule | Threshold |
|---|---|---|
| 1 | Critical defects | Critical = 0 |
| 2 | High defects | Every High defect must have a documented workaround approved by UAT coordinator |
| 3 | Operational reports | Receiving Information, Delivery Slip, and Entry-Delivery Inventory Report must preview and print |
| 4 | Stock balance | Stock balance must reconcile with movement ledger after test transactions |
| 5 | Database integrity | No direct DB edits during UAT — all changes through application UI only |
| 6 | Production safety | Production remains HOLD — no Production migration, apply, or data change |

Friday test run is **NO-GO** if any of the following occur:

- Any Critical defect remains open without resolution
- Any High defect lacks an approved workaround
- Any of the three operational reports fails preview or print
- Stock balance does not reconcile and root cause is unexplained
- Direct database edits were performed during UAT
- Production HOLD was bypassed or Production data was touched

### Go / No-Go Decision Record

| Field | Value |
|---|---|
| Decision date | PENDING CONFIRMATION |
| Critical count | PENDING |
| High count (with workaround) | PENDING |
| Reports verified | PENDING — Receiving Information / Delivery Slip / Entry-Delivery Inventory Report |
| Stock balance reconciled | PENDING |
| Direct DB edits during UAT | Must be NO |
| Production status | HOLD |
| Decision | GO / NO-GO — PENDING CONTROLLER REVIEW |
| Controller sign-off | PENDING |
| FINAL GO authorized | NO — FINAL GO is NOT AUTHORIZED |

## Stock Balance Reconciliation Check

Complete before and after the Friday test run.

| Check Point | Location / Product / Lot | Expected Qty | Actual Qty | Variance | Source Document | Reconciled | Reviewer |
|---|---|---|---|---|---|---|---|
| Baseline (before test) | PENDING | PENDING | PENDING | — | — | PENDING | PENDING |
| After receiving/putaway | PENDING | PENDING | PENDING | PENDING | FTR-REC-001 | PENDING | PENDING |
| After transfer | PENDING | PENDING | PENDING | PENDING | FTR-10 | PENDING | PENDING |
| After adjustment | PENDING | PENDING | PENDING | PENDING | FTR-12 | PENDING | PENDING |
| After dispatch | PENDING | PENDING | PENDING | PENDING | FTR-DSP-001 | PENDING | PENDING |
| Final reconciliation | PENDING | PENDING | PENDING | PENDING | All FTR scenarios | PENDING | PENDING |

## Operational Report UI Verification

| Report Name | UI Entry Point | Preview Action | Print Action | Scenario ID | Status |
|---|---|---|---|---|---|
| Receiving Information | Receiving detail page → Preview / Print | ReportPreviewModal opens | Browser print dialog or print CSS layout | FTR-27 | PENDING |
| Delivery Slip | Outbound list/detail → Preview / Print | ReportPreviewModal opens | Browser print dialog or print CSS layout | FTR-28 | PENDING |
| Entry-Delivery Inventory Report | Movement ledger report page → Preview / Print | ReportPreviewModal opens | Browser print dialog or print CSS layout | FTR-29 | PENDING |

## Stop and Escalation Rules

Stop the test run immediately and escalate to the UAT coordinator if:

- Wrong environment or Production URL detected
- Wrong login role or unexpected permission denial
- Unexpected stock balance change not traceable to current scenario
- Report preview/print fails for all three operational reports
- Data corruption or duplicate document numbers observed
- Any request to edit database directly during UAT

## Related Documents

- `docs/15M_UAT_MASTER_CHECKLIST.md`
- `docs/15N_END_TO_END_UAT_SCRIPT.md`
- `docs/15S_UAT_DEFECT_AND_ISSUE_LOG.md`
- `docs/18J_REAL_UAT_EXECUTION_RUN_SHEET_AND_BUSINESS_USER_INSTRUCTION.md`
- `docs/uat/uat-test-data-master-list.md`

## Controller Acknowledgment

| Role | Name | Date | Acknowledgment |
|---|---|---|---|
| UAT Coordinator | PENDING | PENDING | PENDING |
| Test Data Owner | PENDING | PENDING | PENDING |
| Controller Reviewer | PENDING | PENDING | PENDING |

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
