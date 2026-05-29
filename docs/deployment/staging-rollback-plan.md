# Staging Rollback Plan

## Rollback Trigger Criteria

Rollback may be triggered when:

- App cannot load in staging.
- Critical navigation or role visibility is broken.
- Core operation pages fail to load.
- Reports fail to load for UAT.
- Staging public config is unsafe.
- Unexpected invoice generation, accounting post, ERP live connector, inventory sync, or Express sync behavior appears.
- UAT lead or controller determines staging is not safe for users.

## Rollback Decision Owner

Primary decision owner: Project Controller.

Consulted roles:

- Deployment owner
- QA owner
- UAT owner
- Warehouse manager
- Accounting lead

## Rollback Steps

1. Stop UAT execution and notify users.
2. Record incident and rollback reason.
3. Identify previous approved frontend artifact/version.
4. Restore previous approved frontend artifact to staging.
5. Confirm staging URL loads.
6. Run post-rollback verification.
7. Communicate rollback completion.
8. Log lessons learned.

## Data Rollback Assumptions

- Frontend rollback does not automatically roll back data.
- If staging data was changed during UAT, data restore requires separate approval.
- Any data restore should use staging backup/restore process only.
- Production data must not be affected by staging rollback.

## Frontend Rollback Assumptions

- Previous approved build artifact or version reference is available.
- Rollback is limited to frontend staging artifact unless separately approved.
- No database schema or policy rollback is included in this plan.

## Communication Plan

| Audience | Message | Owner |
|---|---|---|
| UAT testers | Stop-use or resume notice | UAT owner |
| Warehouse manager | Operation impact | Controller |
| Accounting lead | Accounting review impact | Controller |
| Deployment team | Rollback execution status | Deployment owner |
| QA | Retest requirements | QA owner |

## Post-Rollback Verification

- App loads.
- Dashboard loads.
- Core operation pages load.
- Reports page loads.
- Role visibility is acceptable.
- Thai / English toggle works.
- Forbidden out-of-scope actions remain absent.

## Incident Logging

Record:

- Incident ID
- Trigger criteria
- Date/time
- Affected version
- Rollback version
- Owner
- Evidence
- Retest result
- Closure decision

## Lessons Learned

After rollback, document:

- Root cause.
- Detection method.
- Corrective action.
- Preventive action.
- Whether checklist or smoke test needs update.
