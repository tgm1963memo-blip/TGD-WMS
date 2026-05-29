# Post Go-live Monitoring Plan

## Purpose

This document defines the monitoring plan after full production, conditional production, or continued controlled rollout approval.

## Monitoring Period

| Item | Detail |
| --- | --- |
| Monitoring start | To be filled |
| Monitoring end | To be filled |
| Monitoring level | Controlled / Full production / Conditional production |

## Monitoring Owner

| Area | Owner |
| --- | --- |
| Overall monitoring | Business Owner |
| Technical monitoring | IT / Technical |
| Access monitoring | Admin / Controller |
| Warehouse monitoring | Warehouse Manager |
| Accounting review monitoring | Accounting |

## Daily Monitoring Items

- App availability
- Login/access issues
- Role visibility
- Receiving / Putaway status
- Customer Withdrawal / Allocation / Picking / Dispatch / Goods Issue status
- Report availability
- Monthly Storage Billing Summary availability
- Accounting Charge Review availability
- New Critical/High defects
- Backup/rollback readiness

## Weekly Monitoring Items

- Defect trend
- User feedback trend
- Report accuracy evidence
- Accounting review accuracy evidence
- Access review sample
- Security review items
- Performance feedback
- Open gap/action plan status

## Defect Review Cadence

| Severity | Review cadence |
| --- | --- |
| Critical | Immediate and daily until closed |
| High | Daily until resolved or accepted |
| Medium | Twice weekly or sprint planning |
| Low | Weekly backlog review |

## User Feedback Cadence

- Daily feedback during first production week.
- Weekly feedback during stabilization period.
- Additional feedback session after major process issue.

## Report Accuracy Review

Review:

- Inventory Dashboard
- Movement Ledger
- Customer Storage Balance
- Storage Aging
- Warehouse Operation Performance

Evidence should compare report output with known customer-owned inventory and operation records.

## Accounting Review Accuracy Review

Review:

- Monthly Storage Billing Summary
- Accounting Charge Review
- Operation Charge summary
- Review-only behavior

Accounting must confirm no Invoice generation or Accounting post is performed by TGD WMS.

## Backup / Restore Monitoring

- Confirm backup status according to agreed frequency.
- Confirm backup evidence is available.
- Keep restore drill action items open until closed.
- Review rollback owner availability.

## Access Review

- Review admin users.
- Review warehouse_manager and warehouse_staff assignments.
- Review accounting users.
- Review viewer users.
- Confirm removed users no longer have access.

## Security Review

- Review RLS/security evidence status.
- Review direct database access list.
- Review secret exposure checks.
- Review audit log access.
- Review incident/security issue log.

## Performance Review

Monitor:

- App load time feedback
- Report loading feedback
- Operational page responsiveness
- Browser/device issues
- Support tickets related to slowness

## Escalation Process

| Issue type | Escalation |
| --- | --- |
| Security or access issue | Admin / Controller and IT / Technical immediately |
| Customer-owned inventory trust issue | Business Owner and Warehouse Manager immediately |
| Accounting review issue | Accounting and Admin / Controller same day |
| App availability issue | IT / Technical immediately |
| Report accuracy issue | Module owner and Business Owner same day |

## End Of Monitoring Review

At the end of the monitoring period:

- Review defects.
- Review user feedback.
- Review report and accounting review accuracy.
- Review security/access items.
- Review backup/restore status.
- Decide whether to exit hypercare, continue monitoring, or return to controlled rollout.
