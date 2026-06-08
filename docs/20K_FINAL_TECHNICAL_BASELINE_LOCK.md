# 20K Final Technical Baseline Lock

## Phase Status

- 20K is documentation and test-only.
- 20K creates the final technical baseline lock document before the Friday controlled test run.
- 20K does not execute UAT.
- 20K does not create or fabricate lock verification results.
- 20K does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20K does not touch Production data.
- 20K does not authorize Production release.
- 20K does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Lock the technical baseline and Friday test run packet so the controller and IT/system owner have a fixed reference point before Friday controlled UAT begins. Any change after lock requires explicit policy compliance and re-verification.

---

## Baseline Lock Summary

Update placeholders at lock time. Do not declare LOCKED without evidence.

| Item | Baseline / Placeholder | Actual at Lock | Status | Locked By | Lock Date |
|---|---|---|---|---|---|
| Latest commit | `4080925` — Add Friday test run fill-in templates | PENDING | PENDING | IT / system owner | PENDING |
| Git clean status | Working tree clean on `main` | PENDING | PENDING | IT / system owner | PENDING |
| Full test result | `npm test -- --run` — 1537/1537 pass (baseline) | PENDING | PENDING | IT / system owner | PENDING |
| Build result | `npm run build` — PASS (baseline) | PENDING | PENDING | IT / system owner | PENDING |
| Friday packet completion | 20C–20J complete with unit tests | PENDING | PENDING | UAT coordinator | PENDING |
| Report template status | Receiving Information, Delivery Slip, Entry-Delivery Inventory Report — UI preview/print READY | PENDING | PENDING | UAT coordinator | PENDING |
| Technical verification status | 20G TV-01–TV-13 — PENDING EXECUTION | PENDING | PENDING | IT / system owner | PENDING |

### Lock Declaration

| Field | Value |
|---|---|
| Baseline lock status | LOCKED / NOT LOCKED — PENDING |
| Lock issued by | IT / system owner — PENDING |
| Lock approved by | Controller reviewer — PENDING |
| Lock date/time | PENDING CONFIRMATION |
| Lock breaks on Critical defect | YES — controller review required |

---

## Locked Packet List

All packets below are part of the Friday Test Run Pack baseline. Status LOCKED means document and unit test exist and pass at lock time.

| Pack | Document | Unit Test | Packet Status | Locked |
|---|---|---|---|---|
| 20C | `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` | `friday-test-run-readiness-pack.test.js` | READY | PENDING |
| 20D | `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` | `friday-test-run-execution-control.test.js` | READY | PENDING |
| 20E | `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md` | `friday-test-run-data-evidence-pack.test.js` | READY | PENDING |
| 20F | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` | `friday-test-run-controller-summary.test.js` | READY | PENDING |
| 20G | `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md` | `pre-friday-technical-verification-runbook.test.js` | READY | PENDING |
| 20H | `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md` | `final-friday-test-run-packet-index.test.js` | READY | PENDING |
| 20I | `docs/20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md` | `final-pre-test-run-controller-review.test.js` | READY | PENDING |
| 20J | `docs/20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md` | `friday-test-run-fill-in-templates.test.js` | READY | PENDING |
| 20K | `docs/20K_FINAL_TECHNICAL_BASELINE_LOCK.md` | `final-technical-baseline-lock.test.js` | READY | PENDING |

### Friday Test Run Pack Commit History (Reference)

Recent commits at lock creation baseline:

```
4080925 Add Friday test run fill-in templates
7c846ea Add final pre-test run controller review
2735041 Add final Friday test run packet index
22c5d9d Add pre-Friday technical verification runbook
4da17e1 Add Friday test run controller summary
b93a770 Add Friday test run data and evidence pack
6507dff Add Friday test run execution control pack
```

---

## Final Verification Commands

Run in order before declaring baseline LOCKED. Use Windows PowerShell.

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
git status
git log --oneline -15
npm ci
npm test -- --run
npm run build
git status
```

### Verification Result Table

| # | Command | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|
| 1 | `git status` | Clean working tree | PENDING | PENDING | PENDING |
| 2 | `git log --oneline -15` | Friday packs 20C–20J visible | PENDING | PENDING | PENDING |
| 3 | `npm ci` | Exit code 0 | PENDING | PENDING | PENDING |
| 4 | `npm test -- --run` | All tests pass (1537/1537 baseline) | PENDING | PENDING | PENDING |
| 5 | `npm run build` | Exit code 0; dist generated | PENDING | PENDING | PENDING |
| 6 | `git status` (post-build) | Working tree still clean | PENDING | PENDING | PENDING |

---

## Acceptable Change Policy After Lock

Once baseline is LOCKED, only the following changes are permitted before Friday test run ends.

| Change Type | Permitted | Requirements |
|---|---|---|
| Critical defect fix only | Yes | Must be minimal scope; test + build rerun; controller notified |
| Documentation fill-in only | Yes | Fill PENDING fields in 20E/20J templates; no runtime code |
| No new feature | Required | No new business features or UI capabilities |
| No schema/RPC/ledger/stock logic change | Required | No migrations, schema, RPC, stock movement, balance, or ledger edits |
| No production data edit | Required | Staging/UAT only; no Production data touched |
| All fixes require test/build rerun | Required | `npm test -- --run` and `npm run build` must PASS after any code fix |

### Prohibited After Lock

- New features or enhancements
- Migration or schema changes
- RPC logic changes
- Stock movement, balance, or ledger logic changes
- Production data edits or Production environment changes
- FINAL GO or Production release authorization
- Bypassing controller review for Critical defects

### Change After Lock Record

| Change ID | Date | Description | Type | Test Rerun | Build Rerun | Controller Notified | Lock Status |
|---|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | LOCKED |

Lock status after change: LOCKED / BROKEN — requires controller review if Critical.

---

## Friday Start Handoff

Use locked packets in this order on Friday.

| Step | Handoff | Purpose |
|---|---|---|
| 1 | use 20G for technical verification | Run TV-01–TV-13 before 08:30 |
| 2 | use 20F for controller decision | Start decision before timed execution |
| 3 | use 20J for fill-in templates | Environment, users, master data, transactions, reports, reconciliation |
| 4 | use 20D for timed execution | Friday schedule 08:30–16:30 |
| 5 | use 20E for evidence | Detailed data and evidence recording |
| 6 | use 20H for packet navigation | Document order and decision gates |

Supporting references:

- **20C** — Scope and go/no-go rules during execution
- **20I** — Pre-test run controller review before start decision
- **20K** — This baseline lock — fixed technical reference

### Handoff Checklist

| # | Handoff Item | Pack | Status |
|---|---|---|---|
| 1 | Technical verification complete | 20G | PENDING |
| 2 | Controller start decision issued | 20F | PENDING |
| 3 | Fill-in templates distributed | 20J | PENDING |
| 4 | Execution schedule active | 20D | PENDING |
| 5 | Evidence templates ready | 20E | PENDING |
| 6 | Packet index communicated | 20H | PENDING |
| 7 | Baseline lock confirmed | 20K | PENDING |

---

## Explicit Safety Statements

1. **This baseline lock does not authorize Production Go Live.** Locking the baseline approves Friday controlled UAT reference only.
2. **FINAL GO is NOT AUTHORIZED.** No packet in the Friday Test Run Pack issues or replaces FINAL GO.
3. **Production remains HOLD.** All Friday activity occurs in staging/UAT environment only.
4. **Friday test run is controlled UAT only.** Passing Friday UAT is one input to future gate review; it is not Production release approval.
5. **Any Critical defect breaks the lock and requires controller review.** Open Critical defects before or during Friday test run trigger HOLD and lock re-assessment.

---

## Lock Break Conditions

Baseline lock is considered BROKEN if any condition occurs:

| # | Condition | Action |
|---|---|---|
| 1 | Critical defect discovered in locked codebase | STOP — controller review; assess minimal fix |
| 2 | `npm test -- --run` fails after any post-lock change | STOP — fix and rerun before continuing Friday run |
| 3 | `npm run build` fails after any post-lock change | STOP — fix and rerun before continuing Friday run |
| 4 | Schema/RPC/stock/ledger code changed after lock | STOP — not permitted; revert or controller exception |
| 5 | Production data or Production environment touched | STOP — immediate escalation |
| 6 | Git working tree has uncommitted runtime changes at Friday start | HOLD — resolve before 08:30 |

### Lock Break Record

| Break Time | Condition # | Description | Resolver | Lock Restored | Controller Sign-Off |
|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

---

## Controller Baseline Lock Sign-Off

| Field | Value |
|---|---|
| Baseline lock acknowledged | PENDING |
| Lock date/time | PENDING CONFIRMATION |
| IT / system owner | PENDING |
| Controller reviewer | PENDING |
| Acceptable change policy acknowledged | PENDING |
| Friday start handoff acknowledged | PENDING |
| FINAL GO authorized | NO — FINAL GO is NOT AUTHORIZED |

---

## Related Documents

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md`
- `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md`
- `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md`
- `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md`
- `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md`
- `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md`
- `docs/20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md`
- `docs/20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md`

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
