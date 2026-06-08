# 20D Friday Test Run Execution Control

## Phase Status

- 20D is documentation and test-only.
- 20D prepares executable control documents for the Friday controlled test run.
- 20D does not execute UAT.
- 20D does not create or fabricate test results.
- 20D does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20D does not touch Production data.
- 20D does not authorize Production release.
- 20D does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Provide day-of-execution control documents so coordinators, testers, and the controller can run the Friday controlled test run on schedule with clear assignments, test data references, defect logging, stop rules, and an end-of-day decision framework.

## Relationship to 20C

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` defines scope, test data preparation, evidence format, and go/no-go criteria.
- 20D converts that readiness into an executable Friday schedule with live assignment and tracking tables.
- 20D does not override safety boundaries from 20C.
- 20D is not FINAL GO.

## Execution Control Information

| Field | Value |
|---|---|
| Execution date | Friday — PENDING CONFIRMATION |
| Test environment | Staging / UAT — PENDING CONFIRMATION |
| Application URL | PENDING CONFIRMATION |
| UAT coordinator | PENDING OWNER ASSIGNMENT |
| Technical support | PENDING OWNER ASSIGNMENT |
| Evidence owner | PENDING OWNER ASSIGNMENT |
| Defect coordinator | PENDING OWNER ASSIGNMENT |
| Controller reviewer | PENDING OWNER ASSIGNMENT |
| Communication channel | PENDING CONFIRMATION |

## Friday Execution Schedule

Execute in order. Do not skip ahead if a prior block is BLOCKED or STOPPED unless coordinator approves workaround continuation.

| Time | Block | Scenario IDs | Lead Owner | Completion Status | Notes |
|---|---|---|---|---|---|
| 08:30 | Environment check | — | Technical support | PENDING | URL reachable, Production HOLD visible, baseline stock recorded |
| 09:00 | Login / role check | FTR-01, FTR-02 | Admin | PENDING | All assigned role accounts login successfully |
| 09:30 | Master data check | FTR-03, FTR-04 | Test data owner | PENDING | Customer, product, lot, warehouse, location, pallet, barcode aliases verified |
| 10:00 | Receiving | FTR-05, FTR-06, FTR-07, FTR-22 | Warehouse staff | PENDING | Receiving list, detail, report, barcode receiving |
| 10:45 | Putaway | FTR-08, FTR-09, FTR-23 | Warehouse staff | PENDING | Putaway confirmation and barcode putaway |
| 11:30 | Transfer / Adjustment | FTR-10, FTR-11, FTR-12, FTR-13 | Warehouse manager | PENDING | Transfer and positive/negative adjustment |
| 13:00 | Withdrawal Request | FTR-14, FTR-15 | Warehouse staff | PENDING | Withdrawal request list and workflow |
| 13:30 | Allocation | FTR-16, FTR-17 | Warehouse manager | PENDING | Stock allocated to withdrawal lines |
| 14:00 | Picking | FTR-18, FTR-19 | Warehouse staff | PENDING | Pick list and pick confirmation |
| 14:30 | Dispatch | FTR-20, FTR-21 | Warehouse staff | PENDING | Dispatch document and Delivery Slip report |
| 15:00 | Reports preview/print | FTR-27, FTR-28, FTR-29 | UAT coordinator | PENDING | Receiving Information, Delivery Slip, Entry-Delivery Inventory Report |
| 15:30 | Stock balance reconciliation | FTR-24, FTR-25, FTR-26 | Warehouse manager | PENDING | Balance matches movement ledger |
| 16:00 | Defect review | — | Defect coordinator | PENDING | Triage all logged defects by severity |
| 16:30 | Controller decision | — | Controller reviewer | PENDING | End-of-day decision recorded |

### Schedule Block Detail

#### 08:30 — Environment Check

- Confirm staging/UAT URL loads without error.
- Confirm Production HOLD badge visible in UI.
- Confirm no Production URL or credentials in use.
- Record stock balance baseline before first transaction.
- Confirm evidence folder and defect log are ready.

#### 09:00 — Login / Role Check

- Each assigned tester logs in with designated role account.
- Verify dashboard loads and sidebar permissions match role.
- Log any permission failure immediately.

#### 09:30 — Master Data Check

- Verify all FTR test data records from 20C are visible and searchable.
- Confirm barcode aliases resolve to correct product, location, and pallet.

#### 10:00 — Receiving

- Open receiving list; locate `UAT-REC-DEP-001`.
- Verify receiving detail and lines.
- Preview/print Receiving Information report.
- Execute barcode receiving scan if authorized.

#### 10:45 — Putaway

- Open putaway linked to receiving document.
- Confirm location assignment to `UAT-LOC-A01`.
- Execute barcode putaway scan if authorized.
- Verify stock balance reflects putaway.

#### 11:30 — Transfer / Adjustment

- Execute location transfer from `UAT-LOC-A01` to `UAT-LOC-B01`.
- Execute positive and negative adjustment documents.
- Verify source/destination balances and audit trail.

#### 13:00 — Withdrawal Request

- Open withdrawal request list; locate sample request.
- Verify customer, product, lot, and quantity lines.
- Confirm request status workflow progresses as expected.

#### 13:30 — Allocation

- Allocate stock to withdrawal request lines from `UAT-LOC-PICK`.
- Confirm reserved quantity matches available stock.

#### 14:00 — Picking

- Generate and confirm pick list from allocation.
- Record picked quantity; verify reservation status update.

#### 14:30 — Dispatch

- Open dispatch document `UAT-DSP-001`.
- Verify dispatch detail and linked outbound data.
- Preview Delivery Slip report.

#### 15:00 — Reports Preview/Print

- Receiving Information — receiving detail page → Preview / Print.
- Delivery Slip — outbound page → Preview / Print.
- Entry-Delivery Inventory Report — movement ledger page → Preview / Print.
- All three must open preview modal and support print layout.

#### 15:30 — Stock Balance Reconciliation

- Compare location-level balances before and after all Friday transactions.
- Trace each variance to source document in movement ledger.
- Record reconciliation result; escalate mismatch immediately.

#### 16:00 — Defect Review

- Review all defects logged during the day.
- Classify open Critical and High defects.
- Confirm workaround documentation for High defects.

#### 16:30 — Controller Decision

- Record end-of-day decision: PASS / PASS WITH WORKAROUND / HOLD / FAIL.
- Controller sign-off required before closing Friday test run.

## Tester Assignment Table

Assign owner, tester, and backup before 08:30. Update status and evidence link during execution.

| Scenario ID | Module | Owner | Tester | Backup Tester | Status | Evidence Link | Defect ID |
|---|---|---|---|---|---|---|---|
| FTR-01 | Login / Role | Admin | PENDING | PENDING | PENDING | PENDING | — |
| FTR-02 | Login / Role | Admin | PENDING | PENDING | PENDING | PENDING | — |
| FTR-03 | Master Data | Test data owner | PENDING | PENDING | PENDING | PENDING | — |
| FTR-04 | Master Data | Test data owner | PENDING | PENDING | PENDING | PENDING | — |
| FTR-05 | Receiving | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-06 | Receiving | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-07 | Receiving | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-08 | Putaway | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-09 | Putaway | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-10 | Transfer | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-11 | Transfer | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-12 | Adjustment | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-13 | Adjustment | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-14 | Withdrawal Request | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-15 | Withdrawal Request | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-16 | Allocation | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-17 | Allocation | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-18 | Picking | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-19 | Picking | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-20 | Dispatch | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-21 | Dispatch | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-22 | Barcode Receiving | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-23 | Barcode Putaway | Warehouse staff | PENDING | PENDING | PENDING | PENDING | — |
| FTR-24 | Stock Balance | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-25 | Stock Balance | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-26 | Stock Balance | Warehouse manager | PENDING | PENDING | PENDING | PENDING | — |
| FTR-27 | Receiving Information Report | UAT coordinator | PENDING | PENDING | PENDING | PENDING | — |
| FTR-28 | Delivery Slip Report | UAT coordinator | PENDING | PENDING | PENDING | PENDING | — |
| FTR-29 | Entry-Delivery Inventory Report | UAT coordinator | PENDING | PENDING | PENDING | PENDING | — |

Status values: PENDING / IN PROGRESS / PASS / FAIL / BLOCKED / HOLD / STOPPED

## Test Data Execution Sheet

Use this sheet during Friday execution. Confirm each record before the scheduled block. Record actual quantity movement after each transaction.

| Test Data ID | Customer | Product | Lot | Warehouse | Location | Pallet | Barcode Alias | Receiving Document | Dispatch Document | Expected Qty Movement | Actual Qty Movement | Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FTR-ROW-001 | UAT-CUST-A | UAT-FROZEN-A | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-RCV | UAT-PAL-001 | UAT-BAR-SKU-001 | UAT-REC-DEP-001 | — | +PENDING IN to UAT-LOC-RCV | PENDING | PENDING | Receiving block 10:00 |
| FTR-ROW-002 | UAT-CUST-A | UAT-FROZEN-A | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-A01 | UAT-PAL-001 | UAT-BAR-LOC-A01 | UAT-REC-DEP-001 | — | +PENDING IN to UAT-LOC-A01 | PENDING | PENDING | Putaway block 10:45 |
| FTR-ROW-003 | UAT-CUST-A | UAT-FROZEN-A | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-B01 | UAT-PAL-001 | — | — | — | Transfer: -from A01 / +to B01 | PENDING | PENDING | Transfer block 11:30 |
| FTR-ROW-004 | UAT-CUST-A | UAT-FROZEN-A | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-B01 | — | — | — | — | Adjustment +/- PENDING | PENDING | PENDING | Adjustment block 11:30 |
| FTR-ROW-005 | UAT-CUST-B | UAT-CHILLED-B | UAT-LOT-OUT | UAT-WH-MAIN | UAT-LOC-PICK | UAT-PAL-002 | — | — | UAT-DSP-001 | -PENDING OUT from UAT-LOC-PICK | PENDING | PENDING | Allocation/Pick/Dispatch 13:30–14:30 |
| FTR-ROW-006 | UAT-CUST-A | UAT-FROZEN-A | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-A01 | UAT-PAL-001 | UAT-BAR-PAL-001 | — | — | Barcode scan validation only | PENDING | PENDING | Barcode receiving/putaway |
| FTR-ROW-007 | — | — | — | UAT-WH-MAIN | All locations | — | — | — | — | Net zero unexplained variance | PENDING | PENDING | Reconciliation block 15:30 |

### Test Data Quick Reference

| Entity | Code / ID | 20C Reference |
|---|---|---|
| Customer (inbound) | UAT-CUST-A | FTR-CUST-001 |
| Customer (outbound) | UAT-CUST-B | FTR-CUST-002 |
| Product (frozen) | UAT-FROZEN-A | FTR-SKU-001 |
| Product (chilled) | UAT-CHILLED-B | FTR-SKU-002 |
| Lot (receiving) | UAT-LOT-FRESH | FTR-LOT-001 |
| Lot (outbound) | UAT-LOT-OUT | FTR-LOT-002 |
| Warehouse | UAT-WH-MAIN | FTR-WH-001 |
| Location (receiving) | UAT-LOC-RCV | FTR-LOC-001 |
| Location (putaway) | UAT-LOC-A01 | FTR-LOC-002 |
| Location (transfer) | UAT-LOC-B01 | FTR-LOC-003 |
| Location (picking) | UAT-LOC-PICK | FTR-LOC-004 |
| Pallet (inbound) | UAT-PAL-001 | FTR-PAL-001 |
| Pallet (outbound) | UAT-PAL-002 | FTR-PAL-002 |
| Barcode (product) | UAT-BAR-SKU-001 | FTR-BAR-001 |
| Barcode (location) | UAT-BAR-LOC-A01 | FTR-BAR-002 |
| Barcode (pallet) | UAT-BAR-PAL-001 | FTR-BAR-003 |
| Receiving document | UAT-REC-DEP-001 | FTR-REC-001 |
| Dispatch document | UAT-DSP-001 | FTR-DSP-001 |

## Defect Log Template

Log defects immediately during execution. Do not wait until end of day.

| Defect ID | Severity | Scenario ID | Module | Issue | Expected | Actual | Screenshot/Evidence | Owner | Target Fix Time | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| PENDING | Critical / High / Medium / Low | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | Open |

### Defect ID Naming Convention

```
FTR-DEF-[YYYYMMDD]-[NNN]
```

Example: `FTR-DEF-20260613-001`

### Severity Quick Reference

| Severity | Log When | Friday Action |
|---|---|---|
| Critical | Blocks continuation, data integrity risk, wrong stock movement | STOP — escalate immediately |
| High | Major function broken, no workaround | Log workaround before continuing |
| Medium | Workaround exists | Log and continue |
| Low | Minor UI/text issue | Log and continue |

## Stop Rules

Stop the Friday test run immediately when any stop rule is triggered. Notify UAT coordinator and technical support. Do not proceed to next schedule block without coordinator approval.

| # | Stop Rule | Detection | Immediate Action | Resume Condition |
|---|---|---|---|---|
| 1 | Stock balance mismatch | Actual balance does not match expected qty movement and cannot be traced to source document | STOP at current block; record variance; do not execute further transactions | Root cause identified; reconciliation approved by warehouse manager and coordinator |
| 2 | Report cannot preview/print | Receiving Information, Delivery Slip, or Entry-Delivery Inventory Report fails preview or print | STOP reports block; log defect | Report preview/print verified for all three reports |
| 3 | Receiving/dispatch cannot complete | Receiving or dispatch document cannot be created, confirmed, or completed through UI | STOP outbound/inbound block; log defect | Document completes through UI with evidence |
| 4 | Role permission failure | Assigned tester cannot access required module or action | STOP; verify correct role account; log defect | Correct role confirmed; permission verified |
| 5 | Data corruption risk | Duplicate document numbers, wrong customer/product/lot mapping, or unexplained data change | STOP all transactions; preserve evidence | Data integrity confirmed; coordinator approves resume |
| 6 | Any Critical defect | Any defect classified Critical remains open | STOP; escalate to controller | Critical defect resolved or formally downgraded with controller approval |

### Stop Event Record

| Stop Time | Stop Rule # | Triggered By | Scenario ID | Description | Evidence | Coordinator Notified | Resume Approved | Controller Note |
|---|---|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## End-of-Day Decision

Controller records one decision at 16:30. This is not FINAL GO.

| Decision | Definition | Conditions |
|---|---|---|
| PASS | Friday test run completed successfully | Critical = 0; all required scenarios PASS; reports preview/print verified; stock balance reconciled |
| PASS WITH WORKAROUND | Friday test run completed with documented High defect workarounds | Critical = 0; all High defects have approved workaround; stock balance reconciled; reports verified |
| HOLD | Friday test run incomplete or results under review | Open defects without resolution; incomplete scenarios; reconciliation pending |
| FAIL | Friday test run did not meet minimum criteria | Any open Critical defect; stock balance unreconciled; reports failed; Production data touched |

### End-of-Day Decision Record

| Field | Value |
|---|---|
| Decision date | PENDING CONFIRMATION |
| Decision | PASS / PASS WITH WORKAROUND / HOLD / FAIL — PENDING |
| Critical defects (open) | PENDING |
| High defects (open, with workaround) | PENDING |
| Scenarios completed | PENDING / 29 |
| Reports verified | PENDING — Receiving Information / Delivery Slip / Entry-Delivery Inventory Report |
| Stock balance reconciled | PENDING |
| Direct DB edits during UAT | Must be NO |
| Production status | HOLD |
| Controller sign-off | PENDING |
| FINAL GO authorized | NO — FINAL GO is NOT AUTHORIZED |

### Decision Outcome Actions

| Decision | Next Action |
|---|---|
| PASS | Archive evidence; schedule retest only if new scope identified |
| PASS WITH WORKAROUND | Archive evidence; track High defect fixes before next gate |
| HOLD | Complete pending scenarios; schedule follow-up Friday session |
| FAIL | Halt progression; root-cause review; no Production action |

## Communication and Escalation

| Event | Notify | Channel | Within |
|---|---|---|---|
| Stop rule triggered | UAT coordinator + technical support | PENDING CONFIRMATION | 5 minutes |
| Critical defect logged | UAT coordinator + controller | PENDING CONFIRMATION | 5 minutes |
| Block completion | Evidence owner | PENDING CONFIRMATION | End of block |
| End-of-day decision | All testers + project owner | PENDING CONFIRMATION | 16:30 |

## Related Documents

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md`
- `docs/15M_UAT_MASTER_CHECKLIST.md`
- `docs/15S_UAT_DEFECT_AND_ISSUE_LOG.md`
- `docs/18J_REAL_UAT_EXECUTION_RUN_SHEET_AND_BUSINESS_USER_INSTRUCTION.md`

## Controller Acknowledgment

| Role | Name | Date | Acknowledgment |
|---|---|---|---|
| UAT Coordinator | PENDING | PENDING | PENDING |
| Defect Coordinator | PENDING | PENDING | PENDING |
| Controller Reviewer | PENDING | PENDING | PENDING |

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
