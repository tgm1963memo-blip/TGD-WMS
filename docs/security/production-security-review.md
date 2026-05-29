# Production Security Review

## Purpose

This document records the production security review scope for TGD WMS before controlled rollout.

TGD WMS is a Cold Storage, Storage, and Customer Withdrawal system for customer-owned inventory. This review identifies security risks, expected controls, current limitations, and recommended actions before production use.

## Scope

This review covers:

- Authentication readiness
- Role and permission control
- Frontend guard limitations
- Backend/RLS requirements
- Database access controls
- Sensitive data handling
- Audit logging
- Config safety
- Error handling
- Deployment environment security
- Known limitations and next actions

This review does not modify code, database schema, RLS policies, authentication implementation, production data, or deployment automation.

## Current Security Posture

The current system has production readiness foundations in place:

- Frontend role-based navigation and permission guards
- Thai / English UI foundation
- Error boundary foundation
- Config safety validation foundation
- Documentation for deployment readiness, UAT, SOP, support, and Go/No-Go review

The current system still requires production hardening:

- Backend/RLS/security hardening review
- Production authentication replacement for demo role selector
- Real role assignment verification
- Backup/restore testing
- Future secure admin-editable document branding configuration

## Assumptions

- Controlled rollout will not bypass approved security limitations.
- Frontend role guards are treated as user experience controls only.
- Backend RLS and database policies must enforce real production access control.
- Service role credentials must never be exposed to browser code.
- Accounting Charge Review remains review-only.
- No ERP inventory sync, invoice generation, or accounting post is included.

## Authentication Review

Production authentication must provide:

- Verified user identity
- Role assignment tied to approved business roles
- Admin-controlled user provisioning and deactivation
- Session management appropriate for warehouse and accounting users
- Separation between staging and production users

Current limitation:

- Demo role selector is not production authentication and must be replaced or disabled before full production.

## Role And Permission Review

Approved roles:

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

Role expectations:

| Role | Expected production access |
| --- | --- |
| admin | System administration, role oversight, full review access |
| warehouse_manager | Warehouse operation supervision and operational reports |
| warehouse_staff | Assigned warehouse operation pages only |
| accounting | Monthly Storage Billing Summary and Accounting Charge Review |
| viewer | Approved read-only reporting only |

## Frontend Guard Limitation

Frontend navigation and permission guards improve usability and reduce accidental access. They do not provide complete security.

Frontend guards can be bypassed by direct API/database access if backend controls are missing. Production rollout requires backend/RLS enforcement for protected data and actions.

## Backend/RLS Requirement

Backend security must enforce:

- Table-level and row-level access control
- Role-specific read/write permissions
- Customer-owned inventory isolation where applicable
- Warehouse operation write control
- Accounting review read-only control
- Audit log restricted access
- Admin-only access for configuration records

RLS policies must be reviewed against all production-facing tables and views.

## Database Access Control Review

Required controls:

- Restrict direct database access to approved technical administrators only.
- Keep service role credentials outside frontend code and public env variables.
- Confirm anon/authenticated access cannot bypass RLS.
- Confirm staging and production database credentials are separated.
- Confirm database backup and restore access is restricted and logged.

## Sensitive Data Handling Review

Sensitive data includes:

- User profile and role assignments
- Customer records
- Customer-owned inventory balances
- Movement ledger records
- Accounting Charge Review summaries
- Environment variables and API keys
- Audit logs

Required handling:

- Do not expose secrets in frontend builds.
- Do not include service role keys in public env variables.
- Do not log sensitive credentials.
- Restrict accounting review data to approved roles.

## Audit Log Review

Audit logs should support:

- User activity traceability
- Warehouse operation accountability
- Security review evidence
- Error and exception investigation
- Accounting review evidence where applicable

Required controls:

- Audit logs should be append-only from application perspective.
- Audit log visibility should be restricted.
- Audit log records should include user, timestamp, action, entity, and reference where available.

## Config Safety Review

Current config safety foundation checks:

- Public frontend env variables
- Missing required public keys
- Empty env values
- Forbidden secret-like key patterns

Required production controls:

- Review built frontend artifacts for accidental secret exposure.
- Confirm no service role, password, private token, or database URL is present in frontend env.
- Keep staging and production env values separated.

## Error Handling Review

Current error boundary foundation:

- Catches render failures.
- Shows safe fallback message.
- Avoids exposing stack trace to users.

Required production controls:

- Confirm error messages do not leak sensitive data.
- Define support escalation for error screenshots.
- Consider future controlled error reporting after security review.

## Deployment Environment Security Review

Required deployment checks:

- Environment-specific configuration
- Restricted deployment access
- Build artifact review
- HTTPS-only access
- Backup/restore plan and test
- Rollback plan
- User access review before rollout

## Known Limitations

- Backend/RLS/security hardening review remains pending.
- Demo role selector is not production authentication.
- Real production role assignment verification remains pending.
- Backup/restore testing remains pending.
- Admin-editable document branding is future scope.
- Logo upload/storage security is future scope.
- Accounting Charge Review is review-only and does not post accounting.
- ERP connector and ERP inventory sync are out of scope.

## Recommended Next Actions

1. Complete RLS hardening review for all production-facing tables and views.
2. Replace or disable demo role selector for production.
3. Implement production authentication and role assignment verification.
4. Restrict direct database access and verify service role handling.
5. Validate audit log access restrictions.
6. Execute backup/restore test before full production.
7. Review staging/production environment separation.
8. Require final security sign-off before full production rollout.
