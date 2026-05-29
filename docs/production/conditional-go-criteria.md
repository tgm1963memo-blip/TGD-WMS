# Conditional Go Criteria

## Purpose

This document defines the minimum criteria for TGD WMS Conditional Go.

## Conditional Go Meaning

Conditional Go means TGD WMS may proceed beyond controlled rollout with explicit restrictions, required support, monitoring, rollback readiness, and signed business acceptance of remaining gaps.

Conditional Go is not Full Production Go.

## Minimum Criteria For Conditional Go

- No open Critical defects.
- Critical security/auth/access gaps are closed or explicitly accepted with controls.
- Production users and roles are verified.
- Customer-owned inventory evidence remains trustworthy.
- Backup/rollback owner is assigned.
- Support model is active.
- Daily monitoring is required.
- Business Owner signs off conditions.

## Must-have Evidence

- Security/RLS evidence or accepted condition
- Production authentication evidence or accepted restriction
- Role assignment evidence
- Backup/restore readiness evidence or accepted condition
- Business UAT evidence or accepted condition
- Controlled rollout support/defect evidence
- Limitation acknowledgement for restricted modules

## Allowed Modules

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

## Restricted Modules

- Invoice generation
- Accounting post
- Live ERP connector
- ERP inventory sync
- Express sync
- Automated billing finalization
- Production logo upload
- Production branding persistence unless later approved

## Required Support Model

Conditional Go requires:

- Named Business Owner
- Named IT / Technical support
- Named Admin / Controller
- Warehouse Manager support
- Accounting support
- Issue log and daily summary
- Escalation channel

## Required Rollback Readiness

Conditional Go requires:

- Rollback owner
- Rollback decision owner
- Rollback communication template
- Backup/restore evidence or accepted recovery condition
- Post-rollback verification checklist

## Required Sign-off

Sign-off required from:

- Business Owner
- IT / Technical
- Admin / Controller
- Warehouse Manager
- Accounting

## Daily Monitoring Requirement

Daily monitoring must include:

- App availability
- User access
- Role visibility
- Warehouse workflows
- Reports
- Monthly Storage Billing Summary
- Accounting Charge Review
- Critical/High defects
- Rollback readiness

## Conditions That Force Pause

- High defect without approved workaround
- Role/access uncertainty
- Missing daily support owner
- Incomplete evidence that does not yet require No-Go
- Warehouse or accounting users cannot continue safely

## Conditions That Force No-Go

- Open Critical defect
- Customer-owned inventory evidence cannot be trusted
- Unauthorized access risk cannot be controlled
- Rollback readiness unavailable
- Business Owner does not accept remaining risk

## Conditions To Move From Conditional Go To Full Production Go

- All Critical gaps closed.
- High gaps closed or accepted as non-blocking.
- Backup/restore drill evidence attached.
- Production authentication and role assignment verified.
- RLS/security evidence attached.
- UAT and controlled rollout evidence attached.
- Business and technical sign-off completed.
