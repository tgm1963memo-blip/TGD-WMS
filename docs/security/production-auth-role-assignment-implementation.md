# Production Auth Role Assignment Implementation

## Purpose

Sprint 11B creates a safe production authentication and role assignment foundation for TGD WMS.

The foundation prepares the system to replace demo role selection later while preserving current app stability during controlled rollout preparation.

## Scope

This sprint includes:

- Production role model utilities
- Auth role resolver utilities
- Auth readiness audit utilities
- Read-only Auth Readiness admin page
- Demo role selector retirement plan
- Tests for safe fallback and read-only behavior

This sprint does not modify database schema, RLS policies, authentication implementation, warehouse workflows, accounting posting, invoice generation, ERP connector, or inventory sync.

## Current Demo Limitation

The current demo role selector is useful for UAT and role visibility demonstrations only.

It is not production authentication because:

- It is not tied to a verified authenticated user.
- It can be changed by the frontend demo control.
- It does not enforce backend/RLS security.
- It does not prove real role assignment.

## Production Role Model

Approved production roles:

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

The role model is defined in `src/security/productionRoleModel.js`.

The hierarchy is intentionally conservative:

| Role | Purpose |
| --- | --- |
| admin | System administration and controlled full review |
| accounting | Monthly Storage Billing Summary and Accounting Charge Review |
| warehouse_manager | Warehouse operation supervision |
| warehouse_staff | Warehouse operation execution |
| viewer | General read-only reporting |

## Role Resolver Behavior

`src/security/authUserRoleResolver.js` resolves roles from:

- Authenticated user profile
- Auth context profile fields
- Auth metadata fallback if available

The resolver is pure and does not call any network, database, or storage service.

## Viewer Fallback Rule

If no authenticated profile exists, or the role is missing or invalid, the resolver returns:

- role: `viewer`
- fallback: `true`
- warning reason

The system must never grant `admin` by default.

## Admin Assignment Rule

`admin` must be explicitly assigned and reviewed before production. Admin assignment should be restricted to named approved users only.

## Auth Readiness Audit

`src/security/authReadinessAuditService.js` checks:

- Auth provider configured placeholder
- User profile role source placeholder
- Demo role selector disabled before production
- Viewer fallback behavior
- Accounting role review
- Warehouse role review
- Admin assignment review
- No service role exposure in frontend config

The audit is read-only and does not mutate any authentication state.

## Route / Page Behavior

`/admin/auth-readiness` is a read-only admin review page.

The page:

- Shows production auth readiness summary
- Shows demo role selector risk
- Shows role assignment readiness
- Shows warnings
- Shows next action checklist

The page does not provide a save action, role update action, or authentication change action.

## What Is Not Implemented Yet

- Production authentication provider integration
- Real user provisioning workflow
- Backend/RLS role enforcement changes
- Demo role selector removal
- Database schema changes
- RLS policy changes
- User management UI

## Next Sprint Recommendations

1. Connect production auth provider and user profile role source.
2. Disable demo role selector in production builds.
3. Verify backend/RLS policies for each production role.
4. Add production user access review evidence.
5. Add role assignment audit evidence if not already available.
