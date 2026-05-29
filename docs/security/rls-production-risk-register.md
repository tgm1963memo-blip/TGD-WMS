# RLS Production Risk Register

## Purpose

This register tracks backend/RLS security risks that must be reviewed before production readiness decisions.

## Risk Register

| Risk ID | Area | Risk description | Impact | Likelihood | Severity | Existing control | Missing evidence | Required action | Owner | Target sprint/date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RLS-RISK-001 | RLS | RLS not fully evidenced before production | Unauthorized data access or writes may exist | Medium | High | Security review docs | Final RLS evidence | Complete RLS evidence checklist | IT / Technical | To be filled | Open |
| RLS-RISK-002 | Frontend guard | Frontend permission guard mistaken as backend security | False security assumption | Medium | High | Documentation warning | Backend enforcement evidence | Confirm backend/RLS enforcement | IT / Technical | To be filled | Open |
| RLS-RISK-003 | Demo role selector | Demo role selector still active | Role spoofing risk if used as production auth | Medium | High | Auth readiness docs | Production disable/replacement evidence | Disable/replace for production | IT / Technical | To be filled | Open |
| RLS-RISK-004 | Role assignment | User role mismatch | Incorrect access or blocked users | Medium | High | Role model foundation | Real user role evidence | Complete role assignment review | Admin / Controller | To be filled | Open |
| RLS-RISK-005 | Customer-owned inventory | Customer-owned inventory visible to wrong role/customer | Data confidentiality and trust risk | Medium | High | Report/UI guards | Isolation test evidence | Test role/customer boundaries | IT / Technical | To be filled | Open |
| RLS-RISK-006 | Accounting visibility | Warehouse staff can access accounting review | Accounting review data overexposure | Medium | Medium | Frontend role visibility | Backend denial evidence | Test accounting review access | Admin / Controller | To be filled | Open |
| RLS-RISK-007 | Warehouse mutation | Accounting can modify warehouse operations | Unauthorized operation mutation | Low | High | UI read-only scope | Backend write denial evidence | Test accounting write denial | IT / Technical | To be filled | Open |
| RLS-RISK-008 | Viewer mutation | Viewer can modify protected records | Unauthorized data changes | Low | High | UI read-only scope | Backend write denial evidence | Test viewer write denial | IT / Technical | To be filled | Open |
| RLS-RISK-009 | Movement ledger | Movement ledger can be directly modified | Audit/ledger trust loss | Low | Critical | Workflow foundation | Direct write denial evidence | Confirm ledger immutability | IT / Technical | To be filled | Open |
| RLS-RISK-010 | Stock balance | Stock balance can be directly modified | Customer-owned inventory trust loss | Low | Critical | Workflow foundation | Direct write denial evidence | Confirm controlled update path | IT / Technical | To be filled | Open |
| RLS-RISK-011 | Audit logs | Audit logs can be edited or hidden | Evidence tampering risk | Low | High | Audit docs | Audit read/write evidence | Confirm audit log controls | Admin / Controller | To be filled | Open |
| RLS-RISK-012 | Secrets | Service role key exposure | Backend compromise | Low | Critical | Config safety foundation | Build/env evidence | Verify no frontend secret exposure | IT / Technical | To be filled | Open |
| RLS-RISK-013 | Reports | Report data overexposure | Sensitive data visible to wrong users | Medium | High | Frontend role cards | Backend/report access evidence | Test report data access by role | Admin / Controller | To be filled | Open |
