# Backup Restore Strategy

## Purpose

This document defines the backup, restore, and recovery readiness strategy for TGD WMS before controlled rollout.

TGD WMS supports Cold Storage operations for customer-owned inventory, including Receiving, Putaway, Customer Withdrawal, Picking, Dispatch / Goods Issue, reporting, Monthly Storage Billing Summary, and Accounting Charge Review.

## Scope

This strategy covers:

- Database backup assumptions
- Application deployment rollback strategy
- Document/config backup strategy
- Staging and production separation
- Recovery objectives
- Backup evidence requirements
- Restore responsibility
- Known limitations and next actions

This document is planning-only. It does not run backup or restore commands.

## Backup Assumptions

- Production backup must be configured and verified before full production use.
- Staging backup may use separate retention and frequency from production.
- Backup access must be restricted to approved IT / Technical owners.
- Backup evidence must be available for Go/No-Go and recovery review.
- Backup/restore testing must not use uncontrolled production data.

## Database Backup Strategy

Recommended strategy:

- Use platform-supported database backup capability.
- Keep staging and production backup schedules separated.
- Record backup timestamp, environment, owner, and verification evidence.
- Confirm retention period before rollout.
- Confirm restore target environment before executing any restore.
- Restrict backup download/export access.

Minimum backup evidence:

- Backup timestamp
- Backup environment
- Backup status
- Backup owner
- Retention period
- Restore availability confirmation

## Application Deployment Rollback Strategy

Application rollback should rely on the deployment platform or release artifact history.

Rollback requirements:

- Identify current deployed version.
- Identify previous approved version.
- Confirm rollback decision owner.
- Confirm rollback steps and communication plan.
- Verify app startup after rollback.
- Verify role visibility and critical pages after rollback.

## Document / Config Backup Strategy

Documents and configuration that support rollout should be backed up or versioned:

- Deployment checklists
- UAT evidence
- SOP documents
- Go/No-Go sign-off
- Security readiness documents
- Environment variable inventory without secret values
- Document branding configuration once persistence is implemented

Current limitation:

- Admin editable document branding is local draft/preview only and not persisted yet.

## Staging Vs Production Separation

Staging and production must remain separated for:

- Database data
- Environment variables
- User accounts and roles
- Backup schedules
- Restore targets
- Evidence and sign-off records

Production data must not be restored into staging unless approved and sanitized according to policy.

## Recovery Objectives

Recovery objectives must be agreed before controlled rollout.

| Objective | Assumption |
| --- | --- |
| Critical operation continuity | Restore or rollback should prioritize warehouse operation access |
| Data trust | Customer-owned inventory records must be validated after restore |
| Accounting review continuity | Monthly Storage Billing Summary and Accounting Charge Review must be checked after restore |
| User access continuity | Roles and access must be verified after restore |

## RPO Assumption

Initial Recovery Point Objective (RPO) assumption:

- To be confirmed by IT / Technical and Business Owner before rollout.
- Recommended starting assumption: latest available verified backup within the platform-supported backup window.

## RTO Assumption

Initial Recovery Time Objective (RTO) assumption:

- To be confirmed by IT / Technical and Business Owner before rollout.
- Recommended starting assumption: recovery decision, rollback, and smoke validation should be completed within the agreed controlled-rollout support window.

## Backup Frequency Recommendation

Recommended before controlled rollout:

- Production database: at least daily backup, or platform-managed frequency if stronger.
- Staging database: backup before major UAT or rollout simulation.
- Application release artifact: every approved deployment.
- Documentation/evidence: version-controlled or stored in approved evidence location.

## Restore Responsibility

| Responsibility | Owner |
| --- | --- |
| Backup configuration | IT / Technical |
| Restore execution | IT / Technical |
| Restore decision approval | Business Owner / Admin / Controller |
| Warehouse validation | Warehouse Manager |
| Accounting validation | Accounting |
| Final recovery acceptance | Business Owner |

## Backup Evidence Requirement

Evidence should include:

- Backup timestamp screenshot or platform record
- Backup retention record
- Restore test result
- Post-restore validation checklist
- Sign-off record

## Known Limitations

- Backup/restore commands have not been executed as part of Sprint 11D.
- Production backup/restore test remains pending until approved drill execution.
- Admin editable document branding is not persisted yet.
- Logo upload/storage is not implemented yet.
- Accounting Charge Review remains review-only.
- Invoice generation, Accounting post, ERP inventory sync, and Express sync are out of scope.

## Recommended Next Actions

1. Assign recovery owner and rollback decision owner.
2. Confirm platform backup frequency and retention.
3. Schedule a non-production recovery drill.
4. Execute recovery drill using approved environment only.
5. Complete recovery drill checklist and sign-off.
6. Add restore evidence to Go/No-Go review package.
