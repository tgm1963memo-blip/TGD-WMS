# Backup Restore Risk Register

## Purpose

This risk register tracks backup, restore, and recovery risks for TGD WMS controlled rollout readiness.

## Risk Register

| Risk ID | Area | Risk description | Impact | Likelihood | Severity | Existing control | Required control | Owner | Target sprint | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BRSK-001 | Backup | Backup not verified before rollout | Recovery evidence may be unavailable | Medium | High | Deployment checklist | Verify backup timestamp and evidence | IT / Technical | Sprint 11D / before rollout | Open |
| BRSK-002 | Restore | Restore process not tested | Recovery may fail during incident | Medium | High | Recovery drill plan | Execute approved restore drill | IT / Technical | Before full production | Open |
| BRSK-003 | Environment | Production/staging data confusion | Wrong data could be restored or reviewed | Medium | High | Environment docs | Clear environment and restore target approval | IT / Technical | Before rollout | Open |
| BRSK-004 | Config | Environment variable mismatch | App may fail or connect to wrong project | Medium | High | Config safety foundation | Environment config review evidence | IT / Technical | Before rollout | Open |
| BRSK-005 | Access | User role mismatch after restore | Users may lose access or gain incorrect access | Medium | High | Role model docs | Role/access validation after restore | Admin / Controller | Before rollout | Open |
| BRSK-006 | Audit | Audit log completeness risk | Operation evidence may be incomplete | Medium | Medium | Audit foundation | Audit log validation after restore | Admin / Controller | Before full production | Open |
| BRSK-007 | Accounting review | Manual accounting review data mismatch | Monthly Storage Billing Summary or Accounting Charge Review may be unreliable | Medium | High | Review-only reports | Accounting validation after restore | Accounting | Before rollout | Open |
| BRSK-008 | Document branding | Branding config not persisted yet | Branding draft may not survive reload/recovery | High | Low | Preview-only limitation docs | Future persisted branding config | Admin / Controller | Future sprint | Open |
| BRSK-009 | Ownership | Recovery owner not assigned | Recovery response may be delayed | Medium | High | Go/No-Go docs | Assign named recovery owner | Business Owner | Sprint 11D / before rollout | Open |
| BRSK-010 | Decision | No documented rollback decision owner | Rollback may be delayed | Medium | High | Rollback plan docs | Assign rollback decision owner | Business Owner | Before rollout | Open |
