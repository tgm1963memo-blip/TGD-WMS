# SOP: Incident And Support During UAT

## User Support Process

1. User records issue with screenshot or evidence.
2. User identifies module, scenario, role, and test data used.
3. User logs defect using the UAT defect log template.
4. UAT lead triages severity and priority.
5. Builder or assigned owner investigates.
6. Tester retests after fix or workaround.

## Error Boundary Message Handling

If the app shows a generic error fallback:

1. Do not continue data entry in the failed screen.
2. Record error reference or timestamp.
3. Capture screenshot.
4. Record current role, page, action before error, and test data.
5. Notify UAT lead.

## Screenshot / Evidence Collection

Evidence should include:

- Screenshot of issue.
- Scenario ID and step number.
- User role.
- Date/time.
- Test data reference.
- Expected result and actual result.
- Browser and device if relevant.

## Defect Reporting Reference

Use `docs/uat/uat-defect-log-template.md` for defect tracking.

Required fields:

- Defect ID
- Module
- Scenario ID
- Severity
- Priority
- Description
- Steps to reproduce
- Expected result
- Actual result
- Evidence
- Status

## Escalation Levels

- Level 1: UAT tester reports to warehouse manager or accounting lead.
- Level 2: UAT lead reviews severity and confirms reproducibility.
- Level 3: Project controller assigns builder investigation.
- Level 4: Controller decides stop-use, rollback, or No-Go if Critical risk exists.

## Temporary Workaround Recording

Workarounds must include:

- Defect ID.
- Approved workaround steps.
- Owner who approved workaround.
- Risk or limitation.
- Date when workaround should be reviewed again.

## Rollback / Stop-Use Criteria During UAT

Stop use and escalate if:

- Stock balance appears corrupted.
- Customer-owned inventory is assigned to wrong customer.
- Dispatch / Goods Issue reduces wrong stock.
- Accounting summary displays materially incorrect customer charge data.
- Permission visibility exposes accounting review to unauthorized role.
- App repeatedly crashes and blocks UAT execution.

## Control Points

- Critical incidents must be escalated before users continue the affected operation.
- Defect severity and priority must be assigned by the UAT lead or controller.
- Temporary workarounds must be documented and approved.
- Stop-use decisions must include affected module, role, and customer-owned inventory risk where applicable.

## Evidence / Record-keeping

- Keep defect ID, scenario ID, transaction reference, operator name, and timestamp.
- Capture screenshot or evidence before and after the incident where possible.
- Record movement ledger reference and stock balance evidence when the incident affects inventory validation.
- Record reviewer/approver for workaround, retest, rollback, or stop-use decision.
- Keep closure evidence after retest is completed.
