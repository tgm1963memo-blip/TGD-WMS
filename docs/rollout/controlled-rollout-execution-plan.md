# Controlled Rollout Execution Plan

## Purpose

This document defines the controlled rollout execution plan for TGD WMS.

TGD WMS is a Cold Storage, Storage, and Customer Withdrawal system for customer-owned inventory. This rollout is controlled, limited, monitored, and not a full production rollout.

## Scope

The rollout covers selected users, selected modules, daily monitoring, issue escalation, and rollback readiness for initial controlled operation.

## Rollout Type: Controlled Rollout

This is a controlled rollout with limited scope, limited users, active support coverage, and daily review.

## Rollout Assumptions

- Phase 0-10 are approved.
- Sprint 11A, 11B, 11C, and 11D are approved.
- Day 1 is supervised by Business Owner, IT / Technical, Admin / Controller, Warehouse Manager, and Accounting.
- Accounting Charge Review remains review-only.
- Document branding admin draft remains preview-only and is not persisted.
- Rollback decision owner must be available during rollout.

## Rollout Participants

| Participant group | Responsibility |
| --- | --- |
| Business Owner | Final business decision and rollout continuation approval |
| IT / Technical | Environment, support, rollback, and issue triage |
| Admin / Controller | User access, role visibility, and control review |
| Warehouse Manager | Warehouse operation supervision |
| Warehouse Staff | Controlled operation execution |
| Accounting | Monthly Storage Billing Summary and Accounting Charge Review |
| Viewer | Read-only review if approved |

## Rollout Date / Time Placeholder

| Item | Detail |
| --- | --- |
| Rollout date | To be filled |
| Start time | To be filled |
| End-of-day review time | To be filled |
| Environment | Controlled rollout environment |
| Release/version | To be filled |

## Pre-rollout Readiness Checklist

| Check | Required status | Owner | Evidence / notes |
| --- | --- | --- | --- |
| UAT short-cycle completed or conditionally accepted | Ready / Conditional | Business Owner |  |
| Role/access list verified | Ready | Admin / Controller |  |
| Training completed for Day 1 users | Ready | Warehouse Manager / Accounting |  |
| SOP available to users | Ready | Admin / Controller |  |
| Backup/rollback readiness reviewed | Ready | IT / Technical |  |
| Support channel announced | Ready | IT / Technical |  |
| Critical defects open | None | Business Owner |  |

## Day 1 Operating Scope

Day 1 focuses on controlled warehouse operations, reporting, accounting review, access verification, and support process validation.

## Day 1 Allowed Modules

- Master Data review
- Receiving
- Putaway
- Transfer
- Adjustment
- Stock Count
- Customer Withdrawal
- Allocation
- Picking
- Dispatch / Goods Issue
- Inventory Dashboard
- Movement Ledger
- Customer Storage Balance
- Storage Aging
- Monthly Storage Billing Summary
- Accounting Charge Review as review-only
- Document Branding Preview / Admin Draft Preview

## Day 1 Not Allowed Modules

- Invoice generation
- Accounting post
- Live ERP connector
- ERP inventory sync
- Express sync
- Automated billing finalization
- Production logo upload
- Production branding persistence

## User Groups Included

- admin
- warehouse_manager
- warehouse_staff
- accounting
- viewer
- IT / Technical support

## User Groups Excluded

| User group | Reason |
| --- | --- |
| Untrained warehouse users | Training and role verification required first |
| Unverified accounting users | Accounting review access must be approved |
| External users/customers | Customer portal is not in scope |
| ERP users | Live ERP connector is not in scope |

## Support Model

| Support area | Owner | Coverage |
| --- | --- | --- |
| Business decision | Business Owner | Rollout continuation / rollback decision |
| Technical support | IT / Technical | App availability, environment, rollback support |
| Access support | Admin / Controller | User role and navigation verification |
| Warehouse support | Warehouse Manager | Operation questions and control points |
| Accounting support | Accounting | Monthly Storage Billing Summary and Accounting Charge Review |

## Issue Escalation Model

| Severity | Escalation action | Owner |
| --- | --- | --- |
| Critical | Stop affected operation, notify Business Owner and IT immediately | Business Owner / IT |
| High | Review workaround or conditional continuation | Admin / Controller |
| Medium | Track owner and target resolution | Module owner |
| Low | Add to improvement backlog | IT / Technical |

## Rollback Trigger

Rollback should be considered when:

- Critical defect blocks controlled operation.
- Customer-owned inventory evidence cannot be trusted.
- Role/access behavior is unsafe.
- Reports are materially incorrect for business review.
- Accounting review data is unavailable or misleading.
- App availability prevents Day 1 execution.

## Rollback Decision Owner

| Role | Name | Contact | Backup decision owner |
| --- | --- | --- | --- |
| Business Owner | To be filled | To be filled | To be filled |

## Daily Monitoring Approach

- Start-of-day readiness check
- Mid-day issue review
- End-of-day summary
- Critical/high issue decision review
- Next-day action list
- Continue / continue with condition / stop rollout recommendation

## End-of-day Review Process

1. Review users who participated.
2. Review modules used.
3. Review issues logged.
4. Review critical/high issue status.
5. Review workaround use.
6. Review accounting and warehouse summaries.
7. Decide next-day action.
8. Record sign-off or conditions.

## Success Criteria

- Day 1 users can access approved modules.
- Role visibility works as expected.
- Core warehouse modules load and can be reviewed/used within controlled scope.
- Reports load for approved users.
- Monthly Storage Billing Summary and Accounting Charge Review remain review-only.
- No critical unresolved issues.
- Rollback readiness remains confirmed.

## Failure Criteria

- Critical issue blocks operation.
- Unauthorized access is observed.
- Customer-owned inventory evidence is inconsistent.
- Backup/rollback readiness is unavailable.
- Accounting review scope is violated.
- Business Owner decides risk is unacceptable.

## Next Step After Controlled Rollout

After controlled rollout:

- Review daily summaries and issue logs.
- Decide whether to continue, pause, or expand scope.
- Assign fixes or improvements to future sprints.
- Prepare full production readiness only after open risks are accepted or resolved.
