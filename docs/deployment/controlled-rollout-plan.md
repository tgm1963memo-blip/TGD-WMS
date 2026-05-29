# Controlled Rollout Plan

## Purpose

This document defines the controlled rollout approach for TGD WMS after Go/No-Go approval.

The rollout is controlled to reduce operational risk while introducing TGD WMS for Cold Storage, Receiving, Putaway, Storage, Customer Withdrawal, Dispatch / Goods Issue, reporting, and Accounting Charge Review.

## Rollout Approach

- Start with a limited user group and supervised operation.
- Use prepared UAT data and verified roles.
- Run daily support and monitoring during the first rollout period.
- Keep Accounting Charge Review as review-only.
- Do not enable excluded future capabilities during Day 1.
- Record issues in the agreed defect or support log.

## Recommended Rollout Scope

The first controlled rollout should focus on business workflows that have been reviewed through UAT and SOP preparation.

Recommended scope:

- Master Data review
- Warehouse operations
- Inventory reporting
- Monthly Storage Billing Summary review
- Accounting Charge Review as review-only
- Role and language verification
- Support and incident process

## Day 1 Operating Scope

Day 1 should be supervised by Warehouse Manager, Admin / Controller, Accounting, and IT / Technical support.

| Area | Day 1 approach |
| --- | --- |
| Warehouse operation | Run selected controlled transactions |
| Reporting | Review dashboards and reports against expected data |
| Accounting review | Preview only; no posting or invoice creation |
| Support | Log every issue and assign owner |
| Communication | Daily summary to rollout stakeholders |

## Modules Allowed On Day 1

- Master Data review
- Receiving
- Putaway
- Transfer
- Adjustment
- Stock Count
- Customer Withdrawal
- Picking
- Dispatch / Goods Issue
- Inventory Dashboard
- Movement Ledger
- Customer Storage Balance
- Storage Aging
- Monthly Storage Billing Summary
- Accounting Charge Review as review-only

## Modules Not Allowed On Day 1

- Invoice generation
- Accounting post
- Live ERP connector
- ERP inventory sync
- Express sync
- Automated billing finalization

## User Groups Allowed

| User group | Day 1 access |
| --- | --- |
| Warehouse Manager | Warehouse operation supervision and review |
| Warehouse Staff | Assigned operation execution |
| Accounting | Monthly Storage Billing Summary and Accounting Charge Review |
| Admin / Controller | Role, visibility, support, and decision control |
| IT / Technical support | Environment, issue triage, and rollback support |
| Viewer | Read-only review if approved |

## Support Coverage

| Support area | Owner | Coverage notes |
| --- | --- | --- |
| Business process support | Warehouse Manager | Operation questions and control points |
| Accounting review support | Accounting lead | Billing summary review questions |
| Access and role support | Admin / Controller | Role visibility and language support |
| Technical support | IT / Technical | Environment, build, and incident support |

## Daily Monitoring Checklist

| Check | Owner | Status | Evidence / notes |
| --- | --- | --- | --- |
| App loads for allowed users | IT / Technical | Not started |  |
| Role visibility works as expected | Admin / Controller | Not started |  |
| Thai / English toggle works | Admin / Controller | Not started |  |
| Core warehouse transactions can be reviewed | Warehouse Manager | Not started |  |
| Movement Ledger matches expected operation evidence | Warehouse Manager | Not started |  |
| Reports load without forbidden actions | Admin / Controller | Not started |  |
| Monthly Storage Billing Summary remains review-only | Accounting | Not started |  |
| Open defects reviewed | IT / Technical | Not started |  |

## Defect Escalation Process

| Severity | Action | Owner |
| --- | --- | --- |
| Critical | Stop affected operation and escalate immediately | Business Owner / IT |
| High | Review for conditional continuation or rollback | Admin / Controller |
| Medium | Continue if workaround exists; track fix | Module owner |
| Low | Track for later improvement | IT / Technical |

## Rollback Trigger

Rollback should be considered if:

- Critical defect blocks core warehouse operation.
- Stock evidence cannot be trusted during controlled operation.
- User access or role visibility creates unacceptable risk.
- Reporting is materially incorrect for business decision-making.
- Environment instability prevents safe operation.
- Business Owner or Admin / Controller decides rollout risk is too high.

## Rollback Steps Reference

Use `docs/deployment/staging-rollback-plan.md` as the rollback reference.

Before rollback:

- Capture issue evidence.
- Record impacted users and operations.
- Confirm decision owner approval.
- Communicate stop-use instruction if required.

## Communication Plan

| Audience | Message timing | Channel | Owner |
| --- | --- | --- | --- |
| Warehouse users | Before Day 1 start and end of day | To be filled | Warehouse Manager |
| Accounting users | Before accounting review window | To be filled | Accounting |
| Admin / Controller | Daily and on critical issues | To be filled | IT / Technical |
| Business Owner | Daily summary and decision points | To be filled | Admin / Controller |

## Post-rollout Review

After the controlled rollout window:

- Review completed transactions and evidence.
- Review defects and gaps.
- Confirm whether operating scope can expand.
- Confirm whether additional training is required.
- Confirm readiness for next rollout stage or full production planning.

| Review item | Result | Notes |
| --- | --- | --- |
| Warehouse operation readiness | To be filled |  |
| Accounting review readiness | To be filled |  |
| User training readiness | To be filled |  |
| Technical readiness | To be filled |  |
| Next decision | To be filled |  |
