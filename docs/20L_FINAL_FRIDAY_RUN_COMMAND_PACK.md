# 20L Final Friday Run Command Pack

## Phase Status

- 20L is documentation and test-only.
- 20L creates a final copy-paste command pack for Friday morning technical verification and controller handoff.
- 20L does not execute UAT.
- 20L does not create or fabricate verification results.
- 20L does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20L does not touch Production data.
- 20L does not authorize Production release.
- 20L does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Provide one final copy-paste command pack so IT/system owners and controllers can run Friday morning baseline checks, capture evidence, and hand off to the Friday test run without ambiguity.

## Relationship to 20C through 20K

| Pack | Document | Role in Friday Morning |
|---|---|---|
| 20G | `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md` | Technical verification detail |
| 20H | `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md` | Packet navigation |
| 20J | `docs/20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md` | Fill-in templates |
| 20K | `docs/20K_FINAL_TECHNICAL_BASELINE_LOCK.md` | Baseline lock reference |
| 20L | This document | Copy-paste Friday morning commands |

20L does not override safety boundaries from 20C through 20K.
20L is not FINAL GO.

### Baseline at Pack Creation

- Latest commit: `d93b878` — Add final technical baseline lock
- Full test baseline: 1545/1545 pass
- Build baseline: PASS

---

## Command Block 1 — Pre-Run Baseline Check

Run first on Friday morning before 08:30. Copy-paste into Windows PowerShell.

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
git status
git log --oneline -15
```

Expected:
- `git status` — working tree clean (or only documented pending docs)
- `git log --oneline -15` — Friday packs 20C–20K visible in recent commits

---

## Command Block 2 — Clean Install and Validation

Run immediately after Block 1. Do not proceed to handoff if any command fails.

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
npm ci
npm test -- --run
npm run build
git status
```

Expected:
- `npm ci` — exit code 0
- `npm test -- --run` — all tests pass (baseline: 1545/1545)
- `npm run build` — exit code 0; `dist/` generated
- `git status` — working tree still clean post-build

### Full Friday Morning Script (Blocks 1 + 2 Combined)

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
git status
git log --oneline -15
npm ci
npm test -- --run
npm run build
git status
```

---

## Command Block 3 — Evidence Capture Checklist

Complete after Blocks 1 and 2 PASS. Record in 20J Template 1 or evidence folder.

| # | Evidence Item | Action | Status | Evidence Link |
|---|---|---|---|---|
| 1 | Record latest commit | Copy output from `git log --oneline -1` | PENDING | PENDING |
| 2 | Record test result | Copy final line: `Tests X passed` | PENDING | PENDING |
| 3 | Record build result | Copy `built in` success line | PENDING | PENDING |
| 4 | Record git clean status | Copy `git status` output showing clean tree | PENDING | PENDING |
| 5 | Screenshot login page | Open staging/UAT URL; capture login page with Production HOLD visible | PENDING | PENDING |
| 6 | Screenshot report preview page | Open any operational report preview (Receiving Information, Delivery Slip, or Entry-Delivery Inventory Report) | PENDING | PENDING |
| 7 | Screenshot stock balance page | Open inventory/stock balance view; capture read-only baseline | PENDING | PENDING |

### Evidence Naming

```
FTR-00-Baseline-{YYYYMMDD}-{tester}.png
FTR-01-Login-{YYYYMMDD}-{tester}.png
FTR-27-Reports-{YYYYMMDD}-{tester}.png
FTR-24-StockBalance-{YYYYMMDD}-{tester}.png
```

---

## Command Block 4 — Friday Handoff Checklist

Open these documents in order after Blocks 1–3 PASS. Hand off to controller for start decision.

| # | Handoff Step | Document | Path | Status |
|---|---|---|---|---|
| 1 | open 20H packet index | Final Friday Test Run Packet Index | `docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md` | PENDING |
| 2 | open 20G technical verification | Pre-Friday Technical Verification Runbook | `docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md` | PENDING |
| 3 | open 20J fill-in templates | Friday Test Run Fill-In Templates | `docs/20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md` | PENDING |
| 4 | open 20D execution control | Friday Test Run Execution Control | `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` | PENDING |
| 5 | open 20E evidence pack | Friday Test Run Data and Evidence Pack | `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md` | PENDING |
| 6 | open 20F controller summary | Friday Test Run Controller Summary | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` | PENDING |

### Handoff Sequence

1. **20H** — Confirm document order and decision gates
2. **20G** — Complete TV-01–TV-13 technical verification
3. **20J** — Distribute fill-in templates to testers
4. **20F** — Controller issues start decision (before 08:30)
5. **20D** — Begin timed execution at 08:30
6. **20E** — Capture evidence during execution

Supporting references: 20C (scope/go-no-go), 20I (pre-test controller review), 20K (baseline lock).

---

## Expected Result Table

Record one row per command or check. Status: PASS / FAIL / HOLD / NOT TESTED.

| Command / Check | Expected Result | Actual Result | Status | Owner | Evidence Link |
|---|---|---|---|---|---|
| `Set-Location` | Project directory reached | PENDING | PENDING | IT / system owner | PENDING |
| `git status` (pre-run) | Clean working tree | PENDING | PENDING | IT / system owner | PENDING |
| `git log --oneline -15` | Friday packs visible | PENDING | PENDING | IT / system owner | PENDING |
| `npm ci` | Exit code 0 | PENDING | PENDING | IT / system owner | PENDING |
| `npm test -- --run` | All tests pass (1545/1545) | PENDING | PENDING | IT / system owner | PENDING |
| `npm run build` | Exit code 0; dist generated | PENDING | PENDING | IT / system owner | PENDING |
| `git status` (post-build) | Working tree still clean | PENDING | PENDING | IT / system owner | PENDING |
| Record latest commit | Commit hash captured | PENDING | PENDING | IT / system owner | PENDING |
| Record test result | Pass count captured | PENDING | PENDING | IT / system owner | PENDING |
| Record build result | Build success captured | PENDING | PENDING | IT / system owner | PENDING |
| Record git clean status | Clean status captured | PENDING | PENDING | IT / system owner | PENDING |
| Screenshot login page | Login page loads; HOLD visible | PENDING | PENDING | IT / system owner | PENDING |
| Screenshot report preview | Report preview modal opens | PENDING | PENDING | UAT coordinator | PENDING |
| Screenshot stock balance | Balance readable; no edits | PENDING | PENDING | Warehouse manager | PENDING |
| Open 20H packet index | Document opened; order confirmed | PENDING | PENDING | UAT coordinator | PENDING |
| Open 20G technical verification | TV checks ready to execute | PENDING | PENDING | IT / system owner | PENDING |
| Open 20J fill-in templates | Templates distributed | PENDING | PENDING | UAT coordinator | PENDING |
| Open 20D execution control | Schedule and assignments ready | PENDING | PENDING | UAT coordinator | PENDING |
| Open 20E evidence pack | Evidence structure confirmed | PENDING | PENDING | Evidence owner | PENDING |
| Open 20F controller summary | Controller ready for decision | PENDING | PENDING | Controller reviewer | PENDING |

---

## Stop Rules

STOP Friday morning verification and do not begin timed execution if any rule triggers.

| # | Stop Rule | Detection | Immediate Action | Resume Condition |
|---|---|---|---|---|
| 1 | Test fail | `npm test -- --run` exit code ≠ 0 | STOP — capture full output; do not hand off | All tests pass on re-run |
| 2 | Build fail | `npm run build` exit code ≠ 0 | STOP — capture build log | Build passes on re-run |
| 3 | Git dirty after build | Unexpected modified tracked files after build/test | STOP — investigate; do not commit runtime artifacts | Working tree clean |
| 4 | Environment unreachable | Staging/UAT URL does not load | STOP — check Vercel deployment | URL loads; deployment READY |
| 5 | Login fail | Cannot login with UAT accounts | STOP — verify Supabase auth | All assigned accounts login |
| 6 | Report preview/print fail | Any of three reports fails preview or print | STOP — log defect DEF-FTR-xxx | All three reports verified |
| 7 | Stock balance cannot be captured | Opening balance unreadable before transactions | STOP — do not start Friday transactions | Balance captured and recorded |

### Stop Event Record

| Stop Time | Stop Rule # | Description | Evidence | Coordinator Notified | Resume Approved |
|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

---

## Final Safety Statement

The following statements are mandatory for this command pack:

1. **This command pack does not authorize Production Go Live.** Running these commands approves Friday morning technical verification only.
2. **Production remains HOLD.** No Production migration, apply, or data change is authorized.
3. **FINAL GO is NOT AUTHORIZED.** This pack does not issue or replace FINAL GO.
4. **Friday test run is controlled UAT only.** Passing Friday morning checks is one input to the controller start decision.
5. **Any Critical defect triggers HOLD.** Open Critical defects before or during Friday morning verification require controller review before proceeding.

---

## Friday Morning Timeline

| Time | Action | Command Block / Document |
|---|---|---|
| Before 08:00 | Pre-run baseline check | Block 1 |
| Before 08:15 | Clean install and validation | Block 2 |
| Before 08:20 | Evidence capture | Block 3 |
| Before 08:25 | Document handoff | Block 4 |
| 08:25 | Controller start decision | 20F / 20I |
| 08:30 | Begin timed execution | 20D |

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
- `docs/20K_FINAL_TECHNICAL_BASELINE_LOCK.md`

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
