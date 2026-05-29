# Pre-UAT Simulation Plan

## Purpose

This plan prepares Antigravity to run a structured Pre-UAT simulation before business users begin formal UAT. The goal is to detect blocking issues early across Cold Storage operations, Customer-owned inventory flows, reporting, Accounting Charge Review, role visibility, language support, document branding preview, and production readiness checks.

## Scope

- App startup and navigation.
- Role-based visibility.
- Thai / English language behavior.
- Document branding preview.
- Master data readiness.
- Receiving to Putaway.
- Internal Transfer.
- Adjustment.
- Stock Count.
- Customer Withdrawal to Dispatch / Goods Issue.
- Reports review.
- Monthly Storage Billing Summary.
- Accounting Charge Staging Preview.
- Accounting Charge Handoff Review Draft.
- Error boundary smoke check.
- Config readiness check.
- Forbidden scope check.

## Pre-UAT Assumptions

- Staging or UAT environment is available.
- Test data and role accounts are prepared or clearly marked as pending.
- No real customer billing is performed.
- No live ERP connector, inventory sync, Express sync, invoice generation, or accounting post is enabled.
- Antigravity records evidence and defects but does not act as final business approver.

## Required Documents

- `docs/uat/uat-master-plan.md`
- `docs/uat/uat-test-scenarios.md`
- `docs/uat/uat-detailed-test-scripts.md`
- `docs/uat/uat-test-data-master-list.md`
- `docs/uat/uat-role-setup-checklist.md`
- `docs/uat/uat-master-data-preparation-checklist.md`
- `docs/uat/uat-transaction-data-preparation-checklist.md`
- `docs/sop/sop-overview.md`
- `docs/deployment/staging-smoke-test-checklist.md`

## Required Test Data

- Customers.
- Products/SKUs.
- Warehouses, rooms, zones, and locations.
- Pallets and lots.
- Opening stock.
- Goods Deposit / Receiving samples.
- Transfer samples.
- Adjustment samples.
- Stock Count samples.
- Customer Withdrawal, Allocation, Picking, and Dispatch / Goods Issue samples.
- Monthly Storage Billing Summary assumptions.
- Operation Charge assumptions.

## Required Roles

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

## Execution Approach

1. Confirm environment and role access.
2. Run app startup and navigation checks.
3. Run role, language, and document branding preview checks.
4. Run warehouse operation checks using prepared UAT data.
5. Run report and accounting review checks.
6. Run production readiness smoke checks.
7. Record pass/fail/blocked status and evidence for each check.
8. Log defects and risks.
9. Prepare handoff summary for defect fix sprint or business UAT readiness decision.

## Pass / Fail / Blocked Criteria

- Pass: expected result is met and evidence is captured.
- Fail: expected result is not met and the check can be completed enough to identify the issue.
- Blocked: check cannot be executed because environment, data, role, or dependency is missing.

## Defect Severity Rules

- Critical: blocks Pre-UAT or creates risk of incorrect stock, customer-owned inventory, permissions, or accounting review data.
- High: blocks a required flow with no acceptable workaround.
- Medium: issue has workaround or limited scope.
- Low: wording, layout, usability, or minor documentation issue.

## Output Deliverables

- Completed `pre-uat-execution-checklist.md`.
- Completed `pre-uat-defect-log.md`.
- Completed `pre-uat-risk-and-gap-register.md`.
- Evidence screenshots or notes.
- Pre-UAT summary for controller and QA review.

## Handoff To Defect Fix Sprint

Any Critical or High issue should be reviewed for a defect fix sprint before business UAT. Medium and Low issues may be accepted for UAT only with documented workaround and controller approval.
