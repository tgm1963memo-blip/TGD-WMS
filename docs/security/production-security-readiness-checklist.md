# Production Security Readiness Checklist

## Purpose

This checklist records the required security readiness evidence before TGD WMS moves beyond controlled rollout.

## Checklist

| Check ID | Area | Requirement | Evidence required | Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-CHK-001 | Authentication readiness | Production authentication model is defined | Auth design / provider confirmation | Not Started | IT / Technical |  |
| SEC-CHK-002 | Authentication readiness | Demo role selector is disabled or removed for production | Production build/config evidence | Not Started | IT / Technical |  |
| SEC-CHK-003 | Role assignment readiness | Production users are assigned approved roles | User-role review record | Not Started | Admin / Controller |  |
| SEC-CHK-004 | Role assignment readiness | Role changes are controlled by approved admin process | Role change procedure | Not Started | Admin / Controller |  |
| SEC-CHK-005 | RLS readiness | RLS policy coverage reviewed for master data | RLS review evidence | Not Started | IT / Technical |  |
| SEC-CHK-006 | RLS readiness | RLS policy coverage reviewed for stock balances and movement ledger | RLS review evidence | Not Started | IT / Technical |  |
| SEC-CHK-007 | RLS readiness | RLS policy coverage reviewed for warehouse workflows | RLS review evidence | Not Started | IT / Technical |  |
| SEC-CHK-008 | RLS readiness | RLS policy coverage reviewed for accounting review reports | RLS review evidence | Not Started | IT / Technical |  |
| SEC-CHK-009 | Database access readiness | Direct database access is restricted to approved users | Access list and approval record | Not Started | IT / Technical |  |
| SEC-CHK-010 | Database access readiness | Service role credentials are not exposed to frontend | Env/build review evidence | Not Started | IT / Technical |  |
| SEC-CHK-011 | Audit log readiness | Audit log access is restricted | Policy/access review evidence | Not Started | Admin / Controller |  |
| SEC-CHK-012 | Audit log readiness | Audit evidence is available for key workflows | Sample audit evidence | Not Started | Admin / Controller |  |
| SEC-CHK-013 | Config/env readiness | Public env values contain no secrets | Config safety validation evidence | Not Started | IT / Technical |  |
| SEC-CHK-014 | Config/env readiness | Staging and production env values are separated | Environment checklist | Not Started | IT / Technical |  |
| SEC-CHK-015 | Error handling readiness | Error boundary does not expose stack trace to users | Smoke test evidence | Not Started | IT / Technical |  |
| SEC-CHK-016 | Backup/restore readiness | Backup procedure is documented | Backup procedure link/evidence | Not Started | IT / Technical |  |
| SEC-CHK-017 | Backup/restore readiness | Restore procedure has been tested | Restore test result | Not Started | IT / Technical |  |
| SEC-CHK-018 | Staging/production separation readiness | Staging data and production data are separated | Environment evidence | Not Started | IT / Technical |  |
| SEC-CHK-019 | User access review readiness | User access review completed before rollout | Signed access review | Not Started | Admin / Controller |  |
| SEC-CHK-020 | Accounting review readiness | Accounting Charge Review remains review-only | UAT evidence | Not Started | Accounting |  |

## Final Security Sign-off

| Sign-off area | Name | Role | Decision | Signature | Date |
| --- | --- | --- | --- | --- | --- |
| Security / technical |  | IT / Technical | Ready / Blocked / Conditional |  |  |
| Access control |  | Admin / Controller | Ready / Blocked / Conditional |  |  |
| Warehouse operation |  | Warehouse Manager | Ready / Blocked / Conditional |  |  |
| Accounting review |  | Accounting | Ready / Blocked / Conditional |  |  |
| Business approval |  | Business Owner | Ready / Blocked / Conditional |  |  |
