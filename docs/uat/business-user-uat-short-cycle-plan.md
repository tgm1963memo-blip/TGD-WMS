# Business User UAT Short-Cycle Plan

## Purpose

This plan supports a short-cycle Business User UAT for TGD WMS after Pre-UAT simulation passed with no blocker defects. The purpose is to let real warehouse, accounting, admin/controller, and technical support users confirm that the system is ready for the next readiness decision.

## Scope

- Cold Storage operational flow checks.
- Receiving to Putaway.
- Internal Transfer.
- Stock Count / Cycle Count.
- Customer Withdrawal to Dispatch / Goods Issue.
- Monthly Storage Billing Summary.
- Accounting Charge Review.
- Role-based navigation.
- Thai / English language toggle.
- Document Branding Preview.
- Error Boundary / support process.
- Config readiness review.

Out of scope: code changes, database changes, workflow changes, seed scripts, ERP connector, invoice generation, accounting posting, and inventory sync.

## UAT Participants

- Warehouse Manager
- Warehouse Staff
- Accounting
- Admin / Controller
- IT / Technical support

## UAT Schedule Template

| Session | Participant group | Scope | Date/time | Owner | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | Warehouse Staff | Receiving to Putaway |  | Warehouse Manager | Planned |  |
| 2 | Warehouse Manager | Transfer, Stock Count, Customer Withdrawal to Dispatch |  | Warehouse Manager | Planned |  |
| 3 | Accounting | Monthly Storage Billing Summary and Accounting Charge Review |  | Accounting | Planned |  |
| 4 | Admin / Controller | Role, language, branding, config, support |  | Admin / Controller | Planned |  |
| 5 | IT / Technical support | Environment and support readiness |  | IT / Technical | Planned |  |

## Required Data Readiness

- UAT customer data prepared.
- Products/SKUs prepared.
- Warehouses, rooms, zones, and locations prepared.
- Pallets and lots prepared.
- Opening stock prepared.
- Receiving, transfer, stock count, and Customer Withdrawal sample data prepared.
- Monthly Storage Billing Summary and Operation Charge assumptions prepared.

## Required Environment Readiness

- Staging/UAT URL available.
- Public frontend configuration reviewed.
- Test users or approved role-switching method available.
- No live ERP connector enabled.
- No invoice generation or accounting posting enabled.
- No inventory sync enabled.

## Required Roles

- Warehouse Manager
- Warehouse Staff
- Accounting
- Admin / Controller
- IT / Technical support

## Test Execution Approach

1. Confirm data, role, and environment readiness.
2. Execute warehouse scripts first.
3. Execute accounting scripts after relevant data is visible.
4. Execute admin/controller checks.
5. Record actual result, status, evidence, and sign-off for each script.
6. Log defects or open issues immediately.
7. Summarize results and prepare Go/No-Go recommendation.

## Pass / Fail / Blocked Criteria

- Pass: expected result is achieved and evidence is captured.
- Fail: expected result is not achieved.
- Blocked: script cannot be executed due to missing access, data, environment, or dependency.

## Defect Handling Process

1. Record issue in UAT defect log.
2. Assign severity: Critical, High, Medium, or Low.
3. Attach screenshot or evidence.
4. Assign owner.
5. Decide whether fix is required before sign-off.
6. Retest after fix or workaround.

## Sign-Off Process

Each participant group reviews completed scripts, open issues, and evidence. Final sign-off is recorded in `docs/uat/business-user-uat-signoff.md`.
