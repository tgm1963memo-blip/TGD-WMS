# 18A Real UAT Execution Preparation

## Scope
- Real UAT execution preparation only.
- No UAT execution yet.
- No Production touched.
- No Production migration applied.
- No controlled write smoke authorized.
- No runtime code changed.
- No services changed.
- No business logic changed.
- No feature gate behavior changed.
- This document does not authorize Production apply.

## Current readiness state
- Phase 17 UI Polish: COMPLETE
- UI Release Readiness: READY FOR REAL UAT
- Production Readiness: HOLD
- Production Apply: NOT AUTHORIZED
- Controlled Write Smoke: NOT AUTHORIZED
- Latest UI readiness document: docs/17H_UI_RELEASE_READINESS_SUMMARY.md

## UAT environment preparation checklist
- UAT environment URL: PENDING CONFIRMATION
- UAT database/project: PENDING CONFIRMATION
- UAT Supabase project confirmed: PENDING CONFIRMATION
- UAT data seed confirmed: PENDING CONFIRMATION
- Test warehouse confirmed: PENDING CONFIRMATION
- Test customer confirmed: PENDING CONFIRMATION
- Test product confirmed: PENDING CONFIRMATION
- Test lot confirmed: PENDING CONFIRMATION
- Test location confirmed: PENDING CONFIRMATION
- Test pallet/barcode confirmed: PENDING CONFIRMATION
- Test user accounts confirmed: PENDING CONFIRMATION
- Permission profiles confirmed: PENDING CONFIRMATION
- Browser/device confirmed: PENDING CONFIRMATION
- Mobile/handheld browser confirmed: PENDING CONFIRMATION
- Evidence storage location confirmed: PENDING CONFIRMATION

Default status: PENDING CONFIRMATION

## UAT user preparation checklist
- Business user / Warehouse: PENDING ASSIGNMENT
- Business user / Admin: PENDING ASSIGNMENT
- Business user / Manager: PENDING ASSIGNMENT
- IT/System owner: PENDING ASSIGNMENT
- Controller: PENDING ASSIGNMENT
- Sign-off owner: PENDING ASSIGNMENT
- Defect log owner: PENDING ASSIGNMENT
- Escalation owner: PENDING ASSIGNMENT

Default status: PENDING ASSIGNMENT

## UAT scenario list
| Scenario ID | Scenario name | User role | Preconditions | Steps | Expected result | Evidence required | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Login and navigation smoke | | | | | | PENDING | |
| 2 | Dashboard review | | | | | | PENDING | |
| 3 | Inventory / Stock Balance review | | | | | | PENDING | |
| 4 | Movement Ledger review | | | | | | PENDING | |
| 5 | Outbound request review | | | | | | PENDING | |
| 6 | Allocation review | | | | | | PENDING | |
| 7 | Picking review | | | | | | PENDING | |
| 8 | Dispatch review | | | | | | PENDING | |
| 9 | Handheld receiving scan review | | | | | | PENDING | |
| 10 | Handheld putaway scan review | | | | | | PENDING | |
| 11 | Transfer review | | | | | | PENDING | |
| 12 | Adjustment review | | | | | | PENDING | |
| 13 | Safety panel verification | | | | | | PENDING | |
| 14 | Feature gate verification | | | | | | PENDING | |
| 15 | Permission boundary verification | | | | | | PENDING | |
| 16 | No unexpected write trigger by navigation | | | | | | PENDING | |

Result values: PENDING / PASS / FAIL / BLOCKED

## UAT evidence capture standard
- Screenshot required for each scenario.
- Browser URL visible where possible.
- Date/time visible or recorded.
- User role recorded.
- Test data recorded.
- Before/after state recorded for any write-capable UAT action.
- Defect ID required if failed.
- No Production data allowed in screenshots unless explicitly approved.

## UAT defect log template
| Defect ID | Scenario ID | Severity | Title | Description | Steps to reproduce | Expected result | Actual result | Screenshot/evidence link | Owner | Status | Retest result | Controller decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Severity definition:
- Critical: blocks UAT or risks stock/Production safety
- High: core workflow failure
- Medium: workaround exists
- Low: cosmetic or wording issue

## UAT sign-off checklist
- [ ] All critical scenarios passed.
- [ ] No critical defects open.
- [ ] No high defects open unless accepted by business owner.
- [ ] Evidence captured.
- [ ] Defect log reviewed.
- [ ] Business sign-off completed.
- [ ] IT/System sign-off completed.
- [ ] Controller review completed.
- [ ] Production gate packet still pending.
- [ ] Production remains HOLD.

## Production boundary
- This document does not authorize Production apply.
- UAT preparation is not Production readiness.
- FINAL GO must not be inferred from UAT preparation.
- FINAL GO: Apply Outbound migrations 025-030 to Production
- Controlled write smoke remains separate and not authorized.
- APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1

## Controller decision block
18A Real UAT Execution Preparation Result:
- UAT environment checklist:
- UAT users:
- Scenario list:
- Evidence standard:
- Defect log:
- Sign-off checklist:
- Production boundary:
- Decision:
  - READY TO SCHEDULE UAT
  - HOLD
  - NO-GO
- Controller notes:

## Recommendation
Recommend next sprint: 18B Real UAT Execution - Dry Run Scheduling or 18B Real UAT Execution Packet Fill-In

18B should fill actual UAT users, environment URL, selected dates, scenario owners, and evidence location.
Production remains HOLD until real UAT evidence, approval packet, Production gate review, and explicit FINAL GO are complete.
