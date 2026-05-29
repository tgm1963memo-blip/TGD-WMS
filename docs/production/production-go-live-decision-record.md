# Production Go-live Decision Record

## Decision Date

| Field | Value |
| --- | --- |
| Decision date | To be filled |
| Decision time | To be filled |
| Environment | To be filled |
| Release/version | To be filled |

## Decision Owner

| Role | Name |
| --- | --- |
| Business Owner | To be filled |

## Decision Participants

| Role | Name | Participation |
| --- | --- | --- |
| Business Owner |  | Required |
| IT / Technical |  | Required |
| Admin / Controller |  | Required |
| Warehouse Manager |  | Required |
| Accounting |  | Required |

## Evidence Reviewed

| Evidence | Reviewed | Notes |
| --- | --- | --- |
| Controlled rollout summary | Yes / No |  |
| Day 1-5 support summary | Yes / No |  |
| UAT evidence | Yes / No |  |
| Security/RLS readiness evidence | Yes / No |  |
| Auth/role assignment evidence | Yes / No |  |
| Backup/restore evidence | Yes / No |  |
| Training/SOP evidence | Yes / No |  |
| Defect summary | Yes / No |  |

## Defect Status Reviewed

| Severity | Open count | Decision impact |
| --- | ---: | --- |
| Critical |  | Must be zero for production Go |
| High |  | Must be resolved or accepted as condition |
| Medium |  | May be backlog if accepted |
| Low |  | May be backlog |

## Risk Status Reviewed

| Risk area | Reviewed | Notes |
| --- | --- | --- |
| Security / RLS | Yes / No |  |
| Authentication / role assignment | Yes / No |  |
| Backup / restore | Yes / No |  |
| Accounting review scope | Yes / No |  |
| Known limitations | Yes / No |  |

## Rollback Readiness Reviewed

| Item | Status | Notes |
| --- | --- | --- |
| Rollback plan available | Ready / Conditional / Not Ready |  |
| Rollback owner assigned | Ready / Conditional / Not Ready |  |
| Communication plan available | Ready / Conditional / Not Ready |  |
| Post-rollback verification available | Ready / Conditional / Not Ready |  |

## Final Decision

Select one:

- [ ] Full Production Go
- [ ] Conditional Production Go
- [ ] Continue Controlled Rollout
- [ ] No-Go

## Conditions

| Condition ID | Condition | Owner | Due date | Status |
| --- | --- | --- | --- | --- |
| GL-COND-001 |  |  |  | Open |

## Restrictions

| Restriction | Applies? | Notes |
| --- | --- | --- |
| Accounting Charge Review remains review-only | Yes / No |  |
| Invoice generation not approved | Yes | Out of scope |
| Accounting post not approved | Yes | Out of scope |
| ERP inventory sync not approved | Yes | Out of scope |
| Branding persistence not approved | Yes / No | Future scope unless separately approved |
| Logo upload/storage not approved | Yes / No | Future scope unless separately approved |

## Approved Modules

| Module | Approved? | Notes |
| --- | --- | --- |
| Master Data review | Yes / No |  |
| Receiving | Yes / No |  |
| Putaway | Yes / No |  |
| Transfer | Yes / No |  |
| Adjustment | Yes / No |  |
| Stock Count | Yes / No |  |
| Customer Withdrawal | Yes / No |  |
| Allocation | Yes / No |  |
| Picking | Yes / No |  |
| Dispatch / Goods Issue | Yes / No |  |
| Reports | Yes / No |  |
| Monthly Storage Billing Summary | Yes / No |  |
| Accounting Charge Review | Yes / No | Review-only |

## Not Approved Modules

- Invoice generation
- Accounting post
- ERP inventory sync
- Express sync
- Live ERP connector unless separately approved
- Production branding persistence unless separately approved
- Production logo upload/storage unless separately approved

## Support Period

| Item | Detail |
| --- | --- |
| Production support period | To be filled |
| Support owner | To be filled |
| Support channel | To be filled |

## Communication Requirement

Before go-live or continued controlled rollout:

- Notify approved users.
- Confirm support channel.
- Confirm not approved modules.
- Confirm escalation and rollback process.
- Confirm Accounting Charge Review remains review-only.

## Sign-off Table

| Name | Role | Decision | Conditions | Signature | Date |
| --- | --- | --- | --- | --- | --- |
|  | Business Owner | Full Production Go / Conditional Production Go / Continue Controlled Rollout / No-Go |  |  |  |
|  | IT / Technical | Full Production Go / Conditional Production Go / Continue Controlled Rollout / No-Go |  |  |  |
|  | Admin / Controller | Full Production Go / Conditional Production Go / Continue Controlled Rollout / No-Go |  |  |  |
|  | Warehouse Manager | Full Production Go / Conditional Production Go / Continue Controlled Rollout / No-Go |  |  |  |
|  | Accounting | Full Production Go / Conditional Production Go / Continue Controlled Rollout / No-Go |  |  |  |
