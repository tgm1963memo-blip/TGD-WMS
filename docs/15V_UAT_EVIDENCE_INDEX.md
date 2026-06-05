# 15V UAT Evidence Index

## Scope

- UAT evidence index template only.
- No Production touched.
- No migration applied.
- No runtime code changed.
- This document does not authorize Production apply.

Production remains HOLD. Evidence records support UAT review and do not authorize migrations, feature-gate changes, or controlled write smoke.

## Evidence Index Template

| Evidence ID | UAT ID | Module | Evidence type | File/link/reference | Captured by | Captured at | Reviewer | Review result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EVID-15U-001 | UAT-15U-001 | Receiving | screenshot / SQL result / document number / screen recording / user sign-off |  |  |  |  | PASS / HOLD / FAIL / NOT TESTED |  |
|  | UAT-15U-002 | Putaway |  |  |  |  |  |  |  |
|  | UAT-15U-003 | Transfer |  |  |  |  |  |  |  |
|  | UAT-15U-004 | Adjustment |  |  |  |  |  |  |  |
|  | UAT-15U-005 | Outbound Draft |  |  |  |  |  |  |  |
|  | UAT-15U-006 | Reservation |  |  |  |  |  |  |  |
|  | UAT-15U-007 | Pick Confirmation |  |  |  |  |  |  |  |
|  | UAT-15U-008 | Post Outbound |  |  |  |  |  |  |  |
|  | UAT-15U-009 | Barcode / handheld foundation |  |  |  |  |  |  |  |
|  | UAT-15U-010 | Role and permission checks |  |  |  |  |  |  |  |

## Evidence Types

- Screenshot.
- SQL result.
- Document number.
- Screen recording.
- User sign-off.

## Evidence Retention Rule

- Store evidence in the approved release evidence location.
- Keep evidence references stable through Production gate review.
- Retain UAT evidence through go-live, post-apply verification, and the agreed audit retention window.
- Evidence must not include secrets or passwords.
- Evidence should mask tokens, service keys, personal passwords, and any non-required confidential values.

## Result Values

- PASS: Evidence reviewed and accepted.
- HOLD: Evidence incomplete or pending review.
- FAIL: Evidence does not support expected result and requires issue log entry.
- NOT TESTED: Evidence was not captured because the scenario was not executed.

## Issue Linkage

Use issue ID format `UAT-ISSUE-001` when evidence is tied to a failed or blocked UAT scenario.

Critical/High issues block go-live.

## Production Gate Boundary

Production remains HOLD.

FINAL GO: Apply Outbound migrations 025-030 to Production

APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1
