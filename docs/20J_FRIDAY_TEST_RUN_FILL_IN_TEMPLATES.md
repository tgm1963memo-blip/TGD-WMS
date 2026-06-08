# 20J Friday Test Run Fill-In Templates

## Phase Status

- 20J is documentation and test-only.
- 20J creates ready-to-fill templates for Friday controlled test run execution and evidence recording.
- 20J does not execute UAT.
- 20J does not create or fabricate test results.
- 20J does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20J does not touch Production data.
- 20J does not authorize Production release.
- 20J does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Provide ready-to-fill templates so testers can execute and record Friday controlled test run evidence immediately without ambiguity.

## Relationship to 20C through 20I

| Pack | Document | How 20J Complements |
|---|---|---|
| 20C | `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` | Scope and go/no-go reference |
| 20D | `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` | Schedule and scenario IDs |
| 20E | `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md` | Detailed data/evidence structure |
| 20F | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` | Controller decision framework |
| 20G | `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md` | Pre-Friday technical checks |
| 20H | `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md` | Document order and gates |
| 20I | `docs/20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md` | Pre-start controller review |
| 20J | This document | Consolidated fill-in templates for day-of use |

20J does not override safety boundaries from 20C through 20I.
20J is not FINAL GO.

### Evidence Naming Reminder

```
FTR-{scenario}-{module}-{YYYYMMDD}-{tester}.png
```

### Defect ID Reminder

```
DEF-FTR-{running no}
```

---

## Template 1 — Environment and Owner Setup

Complete before Friday 08:30. One row for the test run.

| Field | Value |
|---|---|
| Environment URL | PENDING |
| Vercel Deployment URL | PENDING |
| Supabase Project | PENDING |
| Test Date | PENDING CONFIRMATION |
| Test Coordinator | PENDING |
| Warehouse Owner | PENDING |
| Operations Owner | PENDING |
| IT / System Owner | PENDING |
| Controller Reviewer | PENDING |
| Evidence Folder Link | PENDING |
| Defect Log Link | PENDING |

### Template 1 Verification

| Check | Status | Verified By | Date |
|---|---|---|---|
| Environment is staging/UAT (not Production) | PENDING | IT / system owner | PENDING |
| Vercel deployment is latest and READY | PENDING | IT / system owner | PENDING |
| Supabase project matches staging/UAT | PENDING | IT / system owner | PENDING |
| All owners assigned and notified | PENDING | Test coordinator | PENDING |
| Evidence and defect folders accessible | PENDING | Evidence owner | PENDING |

---

## Template 2 — User and Role Setup

Complete before 09:00 login/role check. Add one row per UAT account.

| User ID / Email | Display Name | Role | Module Access | Login Result | Tester | Evidence Link | Status |
|---|---|---|---|---|---|---|---|
| UAT-ADMIN | PENDING | Admin | Full navigation | PENDING | PENDING | PENDING | PENDING |
| UAT-WH-MGR | PENDING | Warehouse Manager | Operations oversight | PENDING | PENDING | PENDING | PENDING |
| UAT-WH-STAFF | PENDING | Warehouse Staff | Receiving, putaway, outbound ops | PENDING | PENDING | PENDING | PENDING |
| UAT-VIEWER | PENDING | Viewer | Read-only reports | PENDING | PENDING | PENDING | PENDING |
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

Status values: PENDING / PASS / FAIL / BLOCKED

Login Result values: PASS / FAIL / NOT TESTED

---

## Template 3 — Master Data Setup

Complete before 09:30 master data check. Add rows as needed.

| Customer ID/Name | Product ID/Code/Name | Lot No | Warehouse | Location | Pallet | UOM | Barcode Alias | Opening Qty | Status |
|---|---|---|---|---|---|---|---|---|---|
| UAT-CUST-A | UAT-FROZEN-A / PENDING | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-RCV | UAT-PAL-001 | PENDING | UAT-BAR-SKU-001 | PENDING | PENDING |
| UAT-CUST-A | UAT-FROZEN-A / PENDING | UAT-LOT-FRESH | UAT-WH-MAIN | UAT-LOC-A01 | UAT-PAL-001 | PENDING | UAT-BAR-LOC-A01 | PENDING | PENDING |
| UAT-CUST-B | UAT-CHILLED-B / PENDING | UAT-LOT-OUT | UAT-WH-MAIN | UAT-LOC-PICK | UAT-PAL-002 | PENDING | — | PENDING | PENDING |
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

Status values: Not Prepared / Prepared / Verified

---

## Template 4 — Transaction Execution Sheet

Fill during Friday execution (10:00–14:30). One row per scenario execution.

| Scenario ID | Module | Document No | Input Qty | Expected Movement | Expected Balance | Actual Result | Screenshot/Evidence | Defect ID | Status |
|---|---|---|---|---|---|---|---|---|---|
| FTR-05 | Receiving | UAT-REC-DEP-001 | PENDING | +IN to UAT-LOC-RCV | PENDING | PENDING | PENDING | — | PENDING |
| FTR-08 | Putaway | PENDING | PENDING | +IN to UAT-LOC-A01 | PENDING | PENDING | PENDING | — | PENDING |
| FTR-10 | Transfer | PENDING | PENDING | -from A01 / +to B01 | PENDING | PENDING | PENDING | — | PENDING |
| FTR-12 | Adjustment | PENDING | PENDING | +/- per adjustment | PENDING | PENDING | PENDING | — | PENDING |
| FTR-14 | Withdrawal Request | PENDING | PENDING | Request created | PENDING | PENDING | PENDING | — | PENDING |
| FTR-16 | Allocation | PENDING | PENDING | Reserve at UAT-LOC-PICK | PENDING | PENDING | PENDING | — | PENDING |
| FTR-18 | Picking | PENDING | PENDING | Pick confirm | PENDING | PENDING | PENDING | — | PENDING |
| FTR-20 | Dispatch | UAT-DSP-001 | PENDING | -OUT from UAT-LOC-PICK | PENDING | PENDING | PENDING | — | PENDING |
| FTR-22 | Barcode Receiving | UAT-BAR-SKU-001 | PENDING | Scan resolves correctly | PENDING | PENDING | PENDING | — | PENDING |
| FTR-23 | Barcode Putaway | UAT-BAR-LOC-A01 | PENDING | Location scan resolves | PENDING | PENDING | PENDING | — | PENDING |
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |

Status values: PENDING / PASS / FAIL / BLOCKED / HOLD

---

## Template 5 — Report Print Evidence Sheet

Complete during 15:00 reports block. One row per report check.

### Receiving Information

| Report Name | Source Document | Preview Result | Print Result | PDF/Save Result | Tester | Evidence Link | Defect ID | Status |
|---|---|---|---|---|---|---|---|---|
| Receiving Information | UAT-REC-DEP-001 | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |

### Delivery Slip

| Report Name | Source Document | Preview Result | Print Result | PDF/Save Result | Tester | Evidence Link | Defect ID | Status |
|---|---|---|---|---|---|---|---|---|
| Delivery Slip | UAT-DSP-001 | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |

### Entry-Delivery Inventory Report

| Report Name | Source Document | Preview Result | Print Result | PDF/Save Result | Tester | Evidence Link | Defect ID | Status |
|---|---|---|---|---|---|---|---|---|
| Entry-Delivery Inventory Report | Movement ledger | PENDING | PENDING | PENDING | PENDING | PENDING | — | PENDING |

Result values: PASS / FAIL / NOT TESTED

Status values: PENDING / PASS / FAIL / HOLD

---

## Template 6 — Stock Reconciliation Sheet

Complete during 15:30 reconciliation block. Record per product/lot/location or use summary row.

| Opening Balance | Receiving Increase | Putaway Movement | Transfer Movement | Adjustment IN | Adjustment OUT | Allocation Reserved Qty | Dispatch Decrease | Expected Closing Balance | Actual Closing Balance | Variance | Reconciliation Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

### Reconciliation Detail (Optional Rows)

| Location | Product / Lot | Opening Balance | Net Movement | Expected Closing | Actual Closing | Variance | Source Documents | Status |
|---|---|---|---|---|---|---|---|---|
| UAT-LOC-RCV | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-05 | PENDING |
| UAT-LOC-A01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-08, FTR-10 | PENDING |
| UAT-LOC-B01 | UAT-FROZEN-A / UAT-LOT-FRESH | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-10, FTR-12 | PENDING |
| UAT-LOC-PICK | UAT-CHILLED-B / UAT-LOT-OUT | PENDING | PENDING | PENDING | PENDING | PENDING | FTR-16, FTR-18, FTR-20 | PENDING |

Reconciliation Status values: PASS / FAIL / HOLD

Variance must be 0 or fully explained by source documents.

---

## Final Controller Sign-Off Template

Complete at pre-start (before 08:30) or end-of-day (16:30) per 20I / 20F.

| Field | Value |
|---|---|
| Decision | READY TO START TEST RUN / READY WITH CONDITIONS / HOLD / NOT READY — PENDING |
| Remarks | PENDING |
| Controller Name | PENDING |
| Date/Time | PENDING CONFIRMATION |

### Pre-Start Sign-Off Checklist

| # | Item | Status |
|---|---|---|
| 1 | Template 1 — Environment and owners complete | PENDING |
| 2 | Template 2 — User/role login verified | PENDING |
| 3 | Template 3 — Master data Verified | PENDING |
| 4 | 20G technical verification PASS | PENDING |
| 5 | 20I controller review complete | PENDING |
| 6 | Production HOLD confirmed in UI | PENDING |
| 7 | No direct database edits planned | PENDING |

### End-of-Day Sign-Off Checklist

| # | Item | Status |
|---|---|---|
| 1 | Template 4 — All scenarios recorded | PENDING |
| 2 | Template 5 — All three reports verified | PENDING |
| 3 | Template 6 — Reconciliation PASS | PENDING |
| 4 | All defects logged (DEF-FTR-xxx) | PENDING |
| 5 | End-of-day decision per 20F / 20D | PENDING |

### Controller Sign-Off Record

| Sign-Off Type | Decision | Controller Name | Date/Time | Remarks |
|---|---|---|---|---|
| Pre-start | PENDING | PENDING | PENDING | PENDING |
| End-of-day | PENDING | PENDING | PENDING | PENDING |

---

## Explicit Safety Statements

1. **Friday test run is controlled UAT only.** These templates do not authorize Production Go Live.
2. **Production remains HOLD.** No Production migration, apply, or data change is authorized.
3. **FINAL GO is NOT AUTHORIZED.** Controller sign-off approves Friday UAT only.
4. **No direct database edits are allowed.** All changes must go through application UI.
5. **Do not mark PASS without evidence.** Every PASS row requires screenshot or log reference.

---

## Template Usage Order

| Order | Template | When | Owner |
|---|---|---|---|
| 1 | Template 1 — Environment and owners | Before 08:30 | IT / system owner |
| 2 | Template 2 — User and role setup | 09:00 block | Admin |
| 3 | Template 3 — Master data setup | 09:30 block | Test data owner |
| 4 | Template 4 — Transaction execution | 10:00–14:30 | Assigned testers |
| 5 | Template 5 — Report print evidence | 15:00 block | UAT coordinator |
| 6 | Template 6 — Stock reconciliation | 15:30 block | Warehouse manager |
| 7 | Final controller sign-off | Pre-start + 16:30 | Controller reviewer |

---

## Related Documents

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md`
- `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md`
- `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md`
- `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md`
- `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md`
- `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md`
- `docs/20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md`

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
