# Day 1-5 Support Plan

## Purpose

This document defines the support model and defect triage process for the first 1-5 days of TGD WMS controlled rollout.

TGD WMS supports Cold Storage operations for customer-owned inventory, including Receiving, Putaway, Customer Withdrawal, Allocation, Picking, Dispatch / Goods Issue, reporting, Monthly Storage Billing Summary, and Accounting Charge Review.

## Scope

This plan covers:

- Daily support routine
- Issue intake
- Severity classification
- Defect triage
- Escalation
- Workaround approval
- Daily review meeting
- End-of-day reporting
- Continue / pause / stop rollout criteria

This plan does not change application code, database schema, RLS policies, warehouse workflows, integrations, or production data.

## Support Period: Day 1 To Day 5

| Day | Focus |
| --- | --- |
| Day 1 | App access, role visibility, core module availability, issue intake discipline |
| Day 2 | Warehouse operation stability and report review |
| Day 3 | Accounting review stability and workaround review |
| Day 4 | Defect trend review and rollout continuation decision |
| Day 5 | Readiness summary and handoff to full production readiness review |

## Support Participants

| Participant | Responsibility |
| --- | --- |
| Business Owner | Final rollout continuation, pause, or stop decision |
| IT / Technical | Technical support, environment checks, issue triage, rollback readiness |
| Admin / Controller | Role visibility, access review, support coordination |
| Warehouse Manager | Warehouse operation support and defect impact review |
| Warehouse Staff | Report issues with evidence and follow approved workarounds |
| Accounting | Monthly Storage Billing Summary and Accounting Charge Review support |

## Support Hours Placeholder

| Day | Support hours | Notes |
| --- | --- | --- |
| Day 1 | To be filled |  |
| Day 2 | To be filled |  |
| Day 3 | To be filled |  |
| Day 4 | To be filled |  |
| Day 5 | To be filled |  |

## Support Channels Placeholder

| Channel | Purpose | Owner |
| --- | --- | --- |
| Primary support channel | User questions and issue intake | IT / Technical |
| Escalation channel | Critical/high defects and rollback decision | Business Owner / Admin / Controller |
| Evidence storage | Screenshots, notes, and daily summaries | Admin / Controller |

## Daily Support Routine

1. Confirm app availability.
2. Confirm Day 1-5 support owners are available.
3. Review open Critical/High defects.
4. Monitor issue intake during support hours.
5. Confirm approved workarounds.
6. Hold daily review meeting.
7. Complete daily summary.
8. Decide next-day continuation status.

## Issue Intake Process

Users should report:

- Date/time
- Reporter name and department
- Module
- Steps to reproduce
- Expected result
- Actual result
- Business impact
- Evidence or screenshot reference
- Whether a workaround exists

All issues must be entered into the Day 1-5 defect triage board.

## Severity Classification

| Severity | Summary |
| --- | --- |
| Critical | Blocks controlled rollout or creates stock/security/accounting review trust risk |
| High | Major business impact but controlled workaround may exist |
| Medium | Limited impact or workaround available |
| Low | Cosmetic or improvement item |

## Defect Triage Process

1. Log defect with evidence.
2. Assign severity.
3. Assign owner.
4. Identify workaround if available.
5. Decide Go/No-Go impact.
6. Set target resolution date.
7. Retest after fix or workaround.
8. Close, defer, or escalate.

## Escalation Process

| Severity | Escalation |
| --- | --- |
| Critical | Immediate escalation to Business Owner, IT / Technical, Admin / Controller, and affected business owner |
| High | Same-day escalation to module owner and Admin / Controller |
| Medium | Review in daily support meeting |
| Low | Track for improvement backlog |

## Workaround Approval Process

Workarounds must be approved before use when they affect:

- Customer-owned inventory evidence
- Receiving / Putaway
- Customer Withdrawal / Dispatch / Goods Issue
- Monthly Storage Billing Summary
- Accounting Charge Review
- Role/access behavior

Approval owner:

- Warehouse workaround: Warehouse Manager and Admin / Controller
- Accounting workaround: Accounting and Admin / Controller
- Technical workaround: IT / Technical and Business Owner if risk is High or Critical

## Daily Review Meeting

Daily review should cover:

- Active users
- Modules used
- New defects
- Critical/High defects
- Workarounds
- Warehouse operation impact
- Accounting review impact
- Rollback readiness
- Continue / condition / pause / stop decision

## End-of-day Reporting

Each day must produce:

- Daily summary
- Updated defect triage board
- Critical/High issue summary
- Workaround summary
- Next-day action list
- Sign-off or decision record

## Criteria To Continue Rollout

- No open Critical defects.
- High defects have accepted workaround or target resolution.
- Role/access behavior is acceptable.
- Customer-owned inventory evidence remains trustworthy.
- Reports and Accounting Charge Review remain review-only and usable.
- Business Owner accepts remaining risks.

## Criteria To Pause Rollout

- High defect blocks a key area without acceptable workaround.
- User access or training gaps prevent safe use.
- Reports are incomplete but not materially misleading.
- Warehouse or accounting users require additional support before continuing.

## Criteria To Stop Rollout

- Critical defect remains open.
- Customer-owned inventory evidence cannot be trusted.
- Role/access behavior creates security risk.
- Rollback owner or support owner is unavailable during incident.
- Business Owner decides risk is unacceptable.

## Handoff To Full Production Readiness Review

After Day 5:

- Review all defects and workarounds.
- Confirm open risks and conditions.
- Confirm whether controlled rollout can expand.
- Update production readiness gap list.
- Prepare full production readiness recommendation.
