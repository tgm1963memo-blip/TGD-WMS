# Security Risk Register

## Purpose

This register tracks known production security risks for TGD WMS before controlled rollout and full production.

## Risk Register

| Risk ID | Area | Description | Impact | Likelihood | Severity | Existing control | Required control | Owner | Target sprint | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-RISK-001 | Frontend permissions | Frontend permission guard is not backend security | Users may bypass UI controls if backend access is open | Medium | High | Frontend route guards | Backend/RLS enforcement | IT / Technical | Sprint 11B | Open |
| SEC-RISK-002 | Authentication | Demo role selector is not production authentication | Role switching could be unsafe if used in production | Medium | High | UAT-only documentation | Production auth and role assignment | IT / Technical | Sprint 11B | Open |
| SEC-RISK-003 | RLS | RLS policy needs production review | Unauthorized read/write access may be possible | Medium | High | Existing policy foundation assumptions | Complete RLS policy audit | IT / Technical | Sprint 11B | Open |
| SEC-RISK-004 | Database access | Direct database access must be restricted | Bypasses application control | Medium | High | Admin awareness | Access control and audit | IT / Technical | Before production | Open |
| SEC-RISK-005 | Audit logs | Audit log visibility must be limited | Sensitive user/action data may be exposed | Medium | Medium | Audit log foundation | Restricted audit read policies | Admin / Controller | Sprint 11B | Open |
| SEC-RISK-006 | Secrets | Service role keys must never be exposed to frontend | Full backend compromise if exposed | Low | Critical | Config safety foundation | Build/env review and secret handling rules | IT / Technical | Before production | Open |
| SEC-RISK-007 | Storage/logo upload | Storage/logo upload security not yet implemented | Future branding upload could expose unsafe files if uncontrolled | Low | Medium | Upload not implemented | Secure upload design before implementation | IT / Technical | Future sprint | Open |
| SEC-RISK-008 | Backup/restore | Backup/restore not yet tested | Recovery may fail during incident | Medium | High | Rollback documents | Production backup/restore test | IT / Technical | Before full production | Open |
| SEC-RISK-009 | Accounting handoff | Manual accounting handoff must remain review-only | Users may assume WMS posts accounting | Medium | Medium | Scope docs and training | Explicit role/process controls | Accounting | Controlled rollout | Open |
| SEC-RISK-010 | ERP integration | ERP connector is future phase only | Premature connector could create data or accounting risk | Low | Medium | Scope docs | Formal future architecture approval | Business Owner / IT | Future phase | Open |

## Review Cadence

The risk register should be reviewed:

- Before Go/No-Go decision
- Before controlled rollout
- After UAT defect review
- Before full production expansion
- After any security-related incident
