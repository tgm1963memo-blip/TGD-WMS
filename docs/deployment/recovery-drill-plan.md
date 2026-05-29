# Recovery Drill Plan

## Purpose

This document defines the planned recovery drill for TGD WMS controlled rollout readiness.

The drill validates whether backup, restore, rollback, access, application, warehouse operation, reports, and Accounting Charge Review can be verified after a recovery event.

## Drill Scope

Included:

- Backup availability review
- Restore readiness review
- Application deployment rollback readiness
- Environment/config readiness
- Role/access validation
- Core warehouse workflow smoke checks
- Report smoke checks
- Accounting review smoke checks
- Document branding preview check
- Error boundary check
- Rollback communication and sign-off

Excluded:

- Production data changes
- Production database restore unless separately approved
- SQL execution in this documentation sprint
- Database schema changes
- RLS policy changes
- ERP connector
- Invoice generation
- Accounting post
- Inventory sync

## Drill Participants

| Role | Responsibility |
| --- | --- |
| Business Owner | Recovery decision acceptance |
| IT / Technical | Backup/restore and application rollback validation |
| Admin / Controller | Role/access and sign-off coordination |
| Warehouse Manager | Warehouse workflow validation |
| Accounting | Monthly Storage Billing Summary and Accounting Charge Review validation |

## Drill Environment

| Item | Requirement |
| --- | --- |
| Environment | Staging or approved recovery test environment |
| Production access | Not used unless separately approved |
| Test data | Approved UAT or recovery drill data |
| User roles | Admin, Warehouse Manager, Warehouse Staff, Accounting, Viewer |
| Evidence storage | To be filled before drill |

## Preconditions

- Backup source is identified.
- Restore target environment is approved.
- Rollback decision owner is assigned.
- Test users and roles are prepared.
- UAT smoke test data exists.
- Support contact channel is available.
- No production data is touched without explicit approval.

## Required Evidence

- Backup timestamp record
- Restore readiness confirmation
- Application version / rollback artifact record
- Environment/config checklist
- Role/access screenshots
- Warehouse workflow smoke check evidence
- Report smoke check evidence
- Accounting review evidence
- Drill sign-off record

## Drill Steps

| Step | Action | Owner |
| --- | --- | --- |
| 1 | Confirm drill scope and environment | Admin / Controller |
| 2 | Confirm backup availability and timestamp | IT / Technical |
| 3 | Confirm restore target and no production impact | IT / Technical |
| 4 | Review restore procedure without executing unsafe commands | IT / Technical |
| 5 | Confirm application rollback method | IT / Technical |
| 6 | Validate environment/config readiness | IT / Technical |
| 7 | Validate user roles and access | Admin / Controller |
| 8 | Run warehouse operation smoke checks | Warehouse Manager |
| 9 | Run report smoke checks | Warehouse Manager / Accounting |
| 10 | Run Accounting Charge Review smoke checks | Accounting |
| 11 | Confirm rollback communication path | Admin / Controller |
| 12 | Complete post-drill review and sign-off | Business Owner |

## Restore Verification Steps

- Confirm selected backup exists.
- Confirm backup timestamp is within expected range.
- Confirm restore target environment.
- Confirm restore owner.
- Confirm evidence capture method.
- Confirm no unauthorized production data access.

## Data Validation Steps

After an approved restore drill, validate:

- Customers
- Products / SKUs
- Warehouses / rooms / zones / locations
- Lots and pallets
- Customer-owned inventory balances
- Movement Ledger data
- Monthly Storage Billing Summary data
- Accounting Charge Review data

## Application Validation Steps

- App loads successfully.
- Dashboard loads.
- Master Data pages load.
- Core operation pages load.
- Reports pages load.
- Admin review pages load.
- Error boundary fallback remains safe.

## Role / Access Validation Steps

- Admin can access admin review pages.
- Warehouse Manager can access warehouse operation review.
- Warehouse Staff can access assigned operation pages.
- Accounting can access accounting review reports.
- Viewer can access approved read-only reports only.
- Restricted views remain hidden or denied as expected.

## Rollback Decision Criteria

Rollback should be considered if:

- App cannot load.
- Role/access behavior is unsafe.
- Customer-owned inventory evidence cannot be trusted.
- Warehouse operation pages are blocked.
- Reporting is materially incorrect.
- Accounting review data is unavailable.
- Recovery validation cannot be completed.

## Success Criteria

The drill is successful if:

- Backup availability is confirmed.
- Restore/rollback procedure is understood and evidenced.
- Application pages pass smoke checks.
- Role/access checks pass.
- Warehouse operation smoke checks pass.
- Reports and accounting review checks pass.
- No critical unresolved recovery gaps remain.
- Required sign-offs are completed.

## Failure Criteria

The drill fails if:

- Backup cannot be verified.
- Restore owner or target is unclear.
- Critical pages do not load.
- Role/access checks fail with security impact.
- Customer-owned inventory or report evidence is inconsistent.
- Recovery decision owner is not assigned.

## Post-drill Review

Post-drill review should capture:

- Drill result
- Evidence list
- Open risks
- Required conditions before rollout
- Owner and target sprint for each gap
- Final sign-off decision
