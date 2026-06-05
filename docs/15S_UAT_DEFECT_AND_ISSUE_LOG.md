# 15S UAT Defect and Issue Log

## Scope

- UAT defect and issue log template only.
- No Production touched.
- No migration applied.
- No runtime code changed.
- No stock mutation performed.

Production remains HOLD. This document tracks UAT issues and does not authorize Production apply or controlled write smoke.

## Issue Log Template

| Issue ID | Module | Severity | Description | Steps to reproduce | Expected result | Actual result | Owner | Target fix date | Status | Retest evidence | Closure sign-off |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Receiving | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Putaway | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Transfer | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Adjustment | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Outbound Draft | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Reservation | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Pick Confirmation | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |
|  | Post Outbound | Critical / High / Medium / Low |  |  |  |  |  |  | Open |  |  |

## Severity Rules

- Critical: Blocks go-live.
- High: Blocks go-live unless formally accepted through the approved gate.
- Medium: Requires owner, target fix date, and mitigation or retest plan.
- Low: Requires owner and closure plan.

Critical and High defects block go-live.

## Evidence Requirements

Each issue should include:

- Screenshot.
- SQL result where applicable.
- Document number.
- Tester name.
- Timestamp.
- Issue reference if failed.
- Retest evidence.
- Closure sign-off.

## Result Keywords

- PASS: Retest passed and issue can be closed.
- HOLD: Issue remains under review or awaiting retest.
- FAIL: Retest failed or original issue remains unresolved.

## Production Gate Boundary

Production remains HOLD.

FINAL GO: Apply Outbound migrations 025-030 to Production

APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1
