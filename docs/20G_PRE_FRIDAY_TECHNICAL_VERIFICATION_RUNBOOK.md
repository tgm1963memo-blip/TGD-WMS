# 20G Pre-Friday Technical Verification Runbook

## Phase Status

- 20G is documentation and test-only.
- 20G creates a technical verification runbook to execute before the Friday controlled test run starts.
- 20G does not execute UAT.
- 20G does not create or fabricate verification results.
- 20G does not modify runtime UI, services, migrations, database schema, RPC logic, stock movement logic, stock balance logic, or ledger behavior.
- 20G does not touch Production data.
- 20G does not authorize Production release.
- 20G does not authorize FINAL GO.
- Production remains HOLD.

## Business Goal

Provide a repeatable technical verification sequence so IT/system owners can confirm code, build, environment, login, permissions, reports, and read-only stock balance checks before Friday business testers begin.

## Relationship to 20C through 20F

| Pack | Document | Role in Pre-Friday Verification |
|---|---|---|
| 20C | `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md` | Scope and test data requirements |
| 20D | `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md` | Friday schedule and stop rules |
| 20E | `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md` | Fillable data and evidence templates |
| 20F | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` | Controller start/hold decision |
| 20G | This document | Pre-Friday technical verification runbook |

20G hands off to 20F controller decision. 20G is not FINAL GO.

---

## Runbook Control Information

| Field | Value |
|---|---|
| Verification date | PENDING CONFIRMATION (execute before Friday 08:30) |
| Executed by | IT / system owner — PENDING ASSIGNMENT |
| Reviewed by | UAT coordinator — PENDING ASSIGNMENT |
| Controller handoff to | `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md` |
| Target environment | Staging / UAT — PENDING CONFIRMATION |
| Application URL | PENDING CONFIRMATION |
| Supabase project | PENDING CONFIRMATION |
| Vercel deployment | PENDING CONFIRMATION |

---

## Technical Verification Sequence

Execute in order. Do not skip failed local checks before proceeding to environment checks.

| Step | Check | Check ID | Type |
|---|---|---|---|
| 1 | Git status | TV-01 | Local |
| 2 | Git log (last 5 commits) | TV-02 | Local |
| 3 | `npm ci` | TV-03 | Local |
| 4 | `npm test -- --run` | TV-04 | Local |
| 5 | `npm run build` | TV-05 | Local |
| 6 | Environment variable check | TV-06 | Local / Deploy |
| 7 | Vercel deployment check | TV-07 | Deploy |
| 8 | Supabase project check | TV-08 | Deploy |
| 9 | Login page check | TV-09 | UI smoke |
| 10 | Role permission smoke check | TV-10 | UI smoke |
| 11 | Report preview/print smoke check | TV-11 | UI smoke |
| 12 | Stock balance read-only check | TV-12 | UI smoke |
| 13 | Final git status (post-build) | TV-13 | Local |

---

## Windows PowerShell Command Blocks

Run from project root. Use `Set-Location` (not `cd` with `&&`).

### Block A — Navigate to Project

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
```

### Block B — Git Status (Pre-Verification)

```powershell
git status
```

Expected: working tree clean or only documented documentation changes pending commit.

### Block C — Git Log (Baseline Confirmation)

```powershell
git log --oneline -5
```

Expected: latest commits include Friday test run packs (20C–20F) and stabilization work.

### Block D — Clean Install Dependencies

```powershell
npm ci
```

Expected: exit code 0; `node_modules` installed from lockfile.

### Block E — Full Test Suite

```powershell
npm test -- --run
```

Expected: all test files pass (baseline: 1503/1503).

### Block F — Production Build

```powershell
npm run build
```

Expected: exit code 0; `dist/index.html` and assets generated.

### Block G — Git Status (Post-Build)

```powershell
git status
```

Expected: working tree still clean; build artifacts not tracked (or only expected `dist/` if locally generated).

### Block H — Environment Variable Check (Local)

```powershell
Get-Content .env.local -ErrorAction SilentlyContinue | Select-String "VITE_SUPABASE"
```

Or verify in Vercel project settings / deployment environment:

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Must point to staging/UAT Supabase project — not Production |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon key only; never service role in frontend |
| `VITE_ENABLE_POST_OUTBOUND_UI` | Optional | Document actual value if set |

Expected: both required variables present and non-placeholder.

### Block I — Full Local Verification Script (Copy-Paste)

```powershell
Set-Location "C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS"
git status
git log --oneline -5
npm ci
npm test -- --run
npm run build
git status
```

Record exit code and output for each step in the verification result table below.

---

## UI Smoke Check Instructions

Complete TV-09 through TV-12 in the staging/UAT deployment (not Production).

### TV-09 — Login Page Check

1. Open application URL in browser.
2. Confirm login page loads without console errors.
3. Confirm Production HOLD badge or staging indicator visible where applicable.
4. Login with `UAT-ADMIN` test account.
5. Capture screenshot: `FTR-01-Login-YYYYMMDD-IT.png`

Expected: login succeeds; dashboard loads.

### TV-10 — Role Permission Smoke Check

1. Login with `UAT-ADMIN` — confirm full navigation visible.
2. Login with `UAT-WH-STAFF` — confirm receiving/putaway operations accessible.
3. Login with `UAT-VIEWER` — confirm read-only access; write actions blocked or hidden.
4. Capture screenshot per role.

Expected: permissions match role assignment per 20E.

### TV-11 — Report Preview/Print Smoke Check

| Report | UI Path | Check |
|---|---|---|
| Receiving Information | `/operations/receiving/:id` → Preview / Print | Preview modal opens; print layout renders |
| Delivery Slip | `/operations/outbound` → Preview / Print | Preview modal opens; print layout renders |
| Entry-Delivery Inventory Report | `/reports/movement-ledger` → Preview / Print | Preview modal opens; print layout renders |

Expected: all three preview and print without error.

### TV-12 — Stock Balance Read-Only Check

1. Navigate to inventory / stock balance view.
2. Record opening balance for test locations (read-only — no edits).
3. Confirm balance values load without error.
4. Confirm no write/mutation controls triggered during check.

Expected: balances visible and readable; no unintended changes.

---

## Verification Result Table

Record one row per check. Status: PASS / FAIL / HOLD / NOT TESTED.

| Check ID | Command / Action | Expected Result | Actual Result | Status | Evidence Link | Owner |
|---|---|---|---|---|---|---|
| TV-01 | `git status` | Clean working tree or documented pending docs only | PENDING | PENDING | PENDING | IT / system owner |
| TV-02 | `git log --oneline -5` | Expected baseline commits visible | PENDING | PENDING | PENDING | IT / system owner |
| TV-03 | `npm ci` | Exit code 0 | PENDING | PENDING | PENDING | IT / system owner |
| TV-04 | `npm test -- --run` | All tests pass (1503/1503) | PENDING | PENDING | PENDING | IT / system owner |
| TV-05 | `npm run build` | Exit code 0; dist output generated | PENDING | PENDING | PENDING | IT / system owner |
| TV-06 | Environment variable check | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set; staging/UAT only | PENDING | PENDING | PENDING | IT / system owner |
| TV-07 | Vercel deployment check | Latest deployment READY; correct branch; URL reachable | PENDING | PENDING | PENDING | IT / system owner |
| TV-08 | Supabase project check | Staging/UAT project active; not Production | PENDING | PENDING | PENDING | IT / system owner |
| TV-09 | Login page check | Login page loads; UAT-ADMIN login succeeds | PENDING | PENDING | PENDING | IT / system owner |
| TV-10 | Role permission smoke check | Admin, staff, viewer permissions correct | PENDING | PENDING | PENDING | IT / system owner |
| TV-11 | Report preview/print smoke check | All three reports preview and print | PENDING | PENDING | PENDING | IT / system owner |
| TV-12 | Stock balance read-only check | Balances readable; no unintended changes | PENDING | PENDING | PENDING | IT / system owner |
| TV-13 | `git status` (post-build) | Working tree still clean | PENDING | PENDING | PENDING | IT / system owner |

---

## Failure Handling

Stop and escalate to UAT coordinator if any failure cannot be resolved before Friday 08:30.

| Failure | Detection | Immediate Action | Escalate To | Resume Condition |
|---|---|---|---|---|
| Test fail | `npm test -- --run` exit code ≠ 0 | STOP — capture full test output; do not proceed to deploy checks | UAT coordinator + dev owner | All tests pass on re-run |
| Build fail | `npm run build` exit code ≠ 0 | STOP — capture build log | UAT coordinator + dev owner | Build passes on re-run |
| Environment unreachable | Application URL does not load | STOP — check Vercel deployment status | IT / system owner | URL loads; deployment READY |
| Login fail | Cannot login with UAT accounts | STOP — verify Supabase auth and role mapping | Admin + IT / system owner | All assigned accounts login |
| Report print fail | Any of three reports fails preview or print | STOP — log defect `DEF-FTR-xxx` | UAT coordinator | All three reports verified in UAT |
| Stock balance mismatch | Opening balance unreadable or unexpected variance before any transaction | STOP — do not start Friday transactions | Warehouse manager + controller | Balance captured and explained |
| Git dirty after build | Unexpected modified tracked files after build/test | STOP — investigate cause; do not commit runtime artifacts | Dev owner | Working tree clean or only expected changes |

### Failure Event Record

| Failure Time | Check ID | Failure Type | Description | Output / Log Reference | Resolved | Resolver |
|---|---|---|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

---

## Go / No-Go Handoff to Controller

IT / system owner completes this handoff and forwards to controller (20F) before Friday 08:30.

| Decision | Definition | Conditions |
|---|---|---|
| PASS technical verification | All TV-01 through TV-13 PASS | Local tests/build pass; environment reachable; login, permissions, reports, stock read-only all PASS |
| PASS with condition | Core checks PASS; minor issue has documented workaround | TV-04, TV-05, TV-09 must PASS; any conditional item documented with owner |
| HOLD | One or more checks FAIL or NOT TESTED | Cannot proceed until resolved or controller accepts condition |
| FAIL | Critical checks fail with no workaround | Test fail, build fail, environment unreachable, or login fail unresolved |

### Handoff Record

| Field | Value |
|---|---|
| Handoff date | PENDING CONFIRMATION |
| Executed by | IT / system owner — PENDING |
| Checks passed | PENDING — X/13 |
| Decision | PASS technical verification / PASS with condition / HOLD / FAIL — PENDING |
| Conditions (if PASS with condition) | PENDING |
| Evidence package link | PENDING |
| Forwarded to controller | PENDING |
| Controller action (20F) | PENDING — READY FOR FRIDAY TEST RUN / READY WITH CONDITIONS / HOLD / NOT READY |

### Handoff Rules

- PASS only if all 13 checks are PASS.
- PASS with condition only if TV-04, TV-05, TV-09 are PASS and workaround is documented.
- HOLD if any local check (TV-01–TV-05, TV-13) fails.
- FAIL if environment unreachable and cannot be restored before Friday 08:30.
- Handoff does not authorize Production release or FINAL GO.

---

## Explicit Safety Statements

The following statements are mandatory for pre-Friday technical verification:

1. **Technical verification does not authorize Production.** Passing TV checks does not approve Production migration, apply, or data change.
2. **Friday test run does not equal go-live.** Technical readiness is one input to the Friday controller decision; it is not Production release approval.
3. **Production remains HOLD.** All verification occurs against staging/UAT environment only.
4. **FINAL GO is NOT AUTHORIZED.** This runbook does not issue or replace FINAL GO.
5. **No direct database edits are allowed.** All data changes during Friday test run must go through application UI only.

---

## Pre-Verification Checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Confirmed staging/UAT URL (not Production) | IT / system owner | PENDING |
| 2 | Confirmed Supabase project is staging/UAT | IT / system owner | PENDING |
| 3 | Confirmed Vercel deployment branch and environment | IT / system owner | PENDING |
| 4 | UAT account credentials available | Admin | PENDING |
| 5 | Evidence folder ready for TV screenshots | Evidence owner | PENDING |
| 6 | 20F controller summary distributed | UAT coordinator | PENDING |

---

## Related Documents

- `docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md`
- `docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md`
- `docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md`
- `docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md`

Production remains HOLD. FINAL GO is NOT AUTHORIZED.
