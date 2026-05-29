# Defect Severity And Escalation Rules

## Purpose

This document defines severity, escalation, response, workaround, rollback, communication, and final decision rules for controlled rollout support.

## Severity Definitions

| Severity | Definition |
| --- | --- |
| Critical | Blocks controlled rollout or creates unacceptable customer-owned inventory, security, or accounting review risk |
| High | Major business impact; workaround may exist but requires same-day decision |
| Medium | Limited business impact or workaround exists |
| Low | Cosmetic, documentation, or improvement item |

## Critical Defect Definition

A Critical defect includes:

- App unavailable for approved users.
- Unauthorized access to restricted areas.
- Customer-owned inventory evidence cannot be trusted.
- Receiving, Putaway, Customer Withdrawal, Picking, or Dispatch / Goods Issue cannot continue safely.
- Monthly Storage Billing Summary or Accounting Charge Review gives materially misleading information.
- Rollback readiness is unavailable during an incident.

## High Defect Definition

A High defect includes:

- Major workflow issue with business impact.
- Report section unavailable for key users.
- Role visibility issue with limited exposure but no confirmed unauthorized data change.
- Workaround required for warehouse or accounting users.

## Medium Defect Definition

A Medium defect includes:

- Non-blocking workflow issue.
- Display or filtering issue with workaround.
- Training or SOP clarification needed.

## Low Defect Definition

A Low defect includes:

- Cosmetic issue.
- Text improvement.
- Minor layout issue.
- Future usability improvement.

## Escalation Matrix

| Severity | Escalation target | Escalation timing |
| --- | --- | --- |
| Critical | Business Owner, IT / Technical, Admin / Controller, affected module owner | Immediate |
| High | Admin / Controller, IT / Technical, module owner | Same support day |
| Medium | Daily support meeting | End of day |
| Low | Improvement backlog | Weekly or next sprint review |

## Response Time Target Placeholder

| Severity | Target response |
| --- | --- |
| Critical | To be filled |
| High | To be filled |
| Medium | To be filled |
| Low | To be filled |

## Resolution Time Target Placeholder

| Severity | Target resolution |
| --- | --- |
| Critical | To be filled |
| High | To be filled |
| Medium | To be filled |
| Low | To be filled |

## Workaround Rules

- Workarounds must be documented.
- Workarounds must have an owner.
- Workarounds affecting customer-owned inventory require Warehouse Manager approval.
- Workarounds affecting Monthly Storage Billing Summary or Accounting Charge Review require Accounting approval.
- Workarounds affecting access or security require Admin / Controller and IT / Technical approval.
- Workarounds do not replace required defect resolution unless formally accepted.

## Rollback Trigger Conditions

Rollback should be considered when:

- Critical defect remains open.
- No acceptable workaround exists for High defect affecting core operation.
- Customer-owned inventory trust is at risk.
- Role/access behavior creates security risk.
- Accounting review scope is violated.
- Business Owner determines rollout risk is unacceptable.

## Communication Rules

- Critical defects require immediate notification to rollout stakeholders.
- High defects must be included in same-day summary.
- Workarounds must be communicated before users apply them.
- Rollback messages must use the approved communication template.
- End-of-day summaries must include issue count and continuation decision.

## Final Decision Authority

| Decision | Authority |
| --- | --- |
| Continue | Business Owner with input from IT / Technical, Admin / Controller, Warehouse Manager, and Accounting |
| Continue with Condition | Business Owner |
| Pause | Business Owner or delegated Admin / Controller in urgent case |
| Stop | Business Owner |
| Rollback | Business Owner with IT / Technical execution |
