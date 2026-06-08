# 20H Final Friday Test Run Packet Index

## Phase Status

- 20H is documentation and test-only.
- 20H creates one final index document for the Friday controlled test run packet.
- 20H does not execute UAT.
- 20H does not create or fabricate test results.
- 20H does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20H does not touch Production data.
- 20H does not authorize Production release.
- 20H does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Tell the controller and testers exactly which Friday test run documents to use, in what order, and what decision gates apply — from pre-Friday technical verification through end-of-day controller decision.

---

## Packet Inventory

| Pack | Document | Unit Test | Status |
|---|---|---|---|
| 20C | `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` | `tests/unit/friday-test-run-readiness-pack.test.js` | READY |
| 20D | `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` | `tests/unit/friday-test-run-execution-control.test.js` | READY |
| 20E | `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md` | `tests/unit/friday-test-run-data-evidence-pack.test.js` | READY |
| 20F | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` | `tests/unit/friday-test-run-controller-summary.test.js` | READY |
| 20G | `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md` | `tests/unit/pre-friday-technical-verification-runbook.test.js` | READY |
| 20H | `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md` | `tests/unit/final-friday-test-run-packet-index.test.js` | READY |

### Packet Summary

| Pack | One-Line Purpose |
|---|---|
| 20C | What to test, what data is needed, evidence format, go/no-go rules |
| 20D | When to test (schedule), who tests (assignments), when to stop |
| 20E | Fillable master data, transactions, evidence capture, sign-off |
| 20F | Controller readiness, start/hold criteria, end-of-day decision |
| 20G | Pre-Friday technical verification commands and smoke checks |
| 20H | This index — document order, owners, decision gates |

---

## Recommended Use Order

Execute packets in this sequence. Do not skip gates.

| Step | Pack | Action | Gate Before Next Step |
|---|---|---|---|
| **Step 1** | 20G | Execute technical verification (TV-01–TV-13) | PASS technical verification or PASS with condition |
| **Step 2** | 20F | Controller start decision (before 08:30) | READY FOR FRIDAY TEST RUN or READY WITH CONDITIONS |
| **Step 3** | 20E | Fill master data and sample transaction records | All 20E master data rows Verified = YES |
| **Step 4** | 20D | Execute timed test run (08:30–16:30) | No active stop rule; scenarios progressing |
| **Step 5** | 20C | Confirm readiness and apply go/no-go rules during run | Critical = 0; reports verified; stock reconciled |
| **Step 6** | 20F | End-of-day controller decision (16:30) | PASS / PASS WITH WORKAROUND / HOLD / FAIL recorded |

### Step Detail

#### Step 1 — 20G Technical Verification (Pre-Friday)

- Owner: IT / system owner
- When: Before Friday 08:30
- Output: Verification result table complete; handoff decision recorded
- Reference: `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md`

#### Step 2 — 20F Controller Start Decision

- Owner: Controller reviewer
- When: After Step 1 PASS; before 08:30
- Output: Controller decision record — READY FOR FRIDAY TEST RUN / READY WITH CONDITIONS / HOLD / NOT READY
- Reference: `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` — Friday Start Criteria

#### Step 3 — 20E Fill Master/Test Data

- Owner: Test data owner + warehouse staff
- When: Before 09:30 master data check block
- Output: All 20E fillable tables completed; sample documents confirmed
- Reference: `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md`

#### Step 4 — 20D Execute Timed Test Run

- Owner: UAT coordinator + assigned testers
- When: Friday 08:30–16:30 per schedule
- Output: Tester assignment table updated; evidence links recorded; defects logged
- Reference: `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md`

#### Step 5 — 20C Confirm Readiness and Go/No-Go Rules

- Owner: UAT coordinator + defect coordinator
- When: Continuously during Step 4; formal check at 15:00–15:30
- Output: Go/no-go criteria assessed; evidence complete per scenario
- Reference: `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` — Friday Go / No-Go Rules

#### Step 6 — 20F End-of-Day Controller Decision

- Owner: Controller reviewer
- When: Friday 16:30
- Output: End-of-day decision — PASS / PASS WITH WORKAROUND / HOLD / FAIL
- Reference: `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` — End-of-Day Decision (via 20D)

---

## Friday Command Checklist

IT / system owner runs before Friday start. Use Windows PowerShell.

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
git status
git log --oneline -8
npm ci
npm test -- --run
npm run build
git status
```

| # | Command | Expected Result | Status | Owner |
|---|---|---|---|---|
| 1 | `git status` | Clean working tree or documented pending docs only | PENDING | IT / system owner |
| 2 | `git log --oneline -8` | Friday packs 20C–20G visible in recent commits | PENDING | IT / system owner |
| 3 | `npm ci` | Exit code 0 | PENDING | IT / system owner |
| 4 | `npm test -- --run` | All tests pass (baseline: 1511/1511) | PENDING | IT / system owner |
| 5 | `npm run build` | Exit code 0; dist output generated | PENDING | IT / system owner |
| 6 | `git status` | Working tree still clean post-build | PENDING | IT / system owner |

Baseline at index creation: latest commit `22c5d9d` — Add pre-Friday technical verification runbook.

---

## Document Owner Table

| Document | Purpose | Owner | When to Use | Required Output | Evidence Link |
|---|---|---|---|---|---|
| 20C Readiness Pack | Scope, test data prep, evidence format, go/no-go | UAT coordinator | Before and during Friday run | Scenario scope confirmed; go/no-go assessed | PENDING |
| 20D Execution Control | Schedule, assignments, stop rules, end-of-day | UAT coordinator | Friday 08:30–16:30 | Assignment table complete; stop events logged | PENDING |
| 20E Data and Evidence | Fillable master data, transactions, evidence, sign-off | Test data owner | Before 09:30; during execution | Master data verified; evidence files named | PENDING |
| 20F Controller Summary | Start/hold criteria; controller decisions | Controller reviewer | Pre-start (Step 2) and end-of-day (Step 6) | Start and end-of-day decisions recorded | PENDING |
| 20G Technical Verification | Pre-Friday commands and smoke checks | IT / system owner | Before Friday 08:30 (Step 1) | TV-01–TV-13 complete; handoff decision | PENDING |
| 20H Packet Index | Document order, owners, decision gates | UAT coordinator | Reference throughout Friday | All steps and gates understood | PENDING |

---

## Decision Gate Summary

| Gate | Source Pack | Criteria | PASS | HOLD / FAIL |
|---|---|---|---|---|
| **Start gate** | 20G → 20F | 20G TV checks PASS; 20F start criteria 10/10 PASS | READY FOR FRIDAY TEST RUN | HOLD or NOT READY |
| **Stop gate** | 20D | Any stop rule triggered during execution | No stop rule active | STOP — escalate per 20D |
| **Defect gate** | 20C + 20D + 20E | Critical = 0; High has workaround | Continue or PASS end-of-day | HOLD if Critical open |
| **Stock reconciliation gate** | 20C + 20E | Balance reconciles with movement ledger | Reconciliation PASS | FAIL if unexplained variance |
| **Report print gate** | 20C + 20E | All three reports preview and print | All three PASS | HOLD if any report fails |
| **End-of-day decision gate** | 20F + 20D | All scenarios assessed; defects triaged | PASS or PASS WITH WORKAROUND | HOLD or FAIL |

### Gate Flow

```
Step 1 (20G) ──► Start Gate ──► Step 2 (20F start decision)
                                      │
Step 3 (20E) ◄────────────────────────┘
      │
Step 4 (20D) ──► Stop Gate (if triggered) ──► PAUSE
      │              Defect Gate (continuous)
      │              Report Print Gate (15:00)
      │              Stock Reconciliation Gate (15:30)
      │
Step 5 (20C go/no-go confirm)
      │
Step 6 (20F end-of-day decision) ──► End-of-Day Decision Gate
```

---

## Role Quick Reference

| Role | Primary Documents | Key Actions |
|---|---|---|
| IT / system owner | 20G, 20H command checklist | Run technical verification; confirm environment |
| Controller reviewer | 20F, 20H decision gates | Start decision (Step 2); end-of-day decision (Step 6) |
| UAT coordinator | 20C, 20D, 20H | Coordinate schedule; confirm go/no-go |
| Test data owner | 20E | Fill and verify master data (Step 3) |
| Warehouse staff | 20D, 20E | Execute operational scenarios |
| Evidence owner | 20E | Manage evidence folder and naming |
| Defect coordinator | 20C, 20D, 20E | Log DEF-FTR defects; triage by severity |

---

## Final Safety Statements

The following statements apply to the entire Friday test run packet (20C–20H):

1. **Friday test run is not Production Go Live.** Completing Friday UAT does not authorize Production release.
2. **Production remains HOLD.** No Production migration, apply, or data change is authorized.
3. **FINAL GO is NOT AUTHORIZED.** No packet in this index issues or replaces FINAL GO.
4. **No direct database edits.** All data changes must go through application UI only.
5. **No uncontrolled Production stock movement.** All Friday transactions occur in staging/UAT environment only.
6. **Any Critical defect triggers HOLD.** Open Critical defects block end-of-day PASS until resolved or formally downgraded with controller approval.

---

## Packet Completion Checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | 20G technical verification complete | IT / system owner | PENDING |
| 2 | 20F start decision issued | Controller reviewer | PENDING |
| 3 | 20E master data filled and verified | Test data owner | PENDING |
| 4 | 20D schedule executed (08:30–16:30) | UAT coordinator | PENDING |
| 5 | 20C go/no-go rules assessed | UAT coordinator | PENDING |
| 6 | 20F end-of-day decision issued | Controller reviewer | PENDING |
| 7 | All evidence archived per 20E naming standard | Evidence owner | PENDING |
| 8 | All defects logged per DEF-FTR standard | Defect coordinator | PENDING |

---

## Related Documents (Outside 20C–20H)

- `docs/15M_UAT_MASTER_CHECKLIST.md`
- `docs/15S_UAT_DEFECT_AND_ISSUE_LOG.md`
- `docs/15W_UAT_CONTROLLER_READINESS_SUMMARY.md`
- `docs/18J_REAL_UAT_EXECUTION_RUN_SHEET_AND_BUSINESS_USER_INSTRUCTION.md`
- `docs/uat/uat-test-data-master-list.md`

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
