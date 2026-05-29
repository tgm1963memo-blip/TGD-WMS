# Demo Role Selector Retirement Plan

## Purpose

This document defines the safe retirement plan for the demo role selector before TGD WMS full production use.

## Why Demo Selector Must Not Be Used In Production

The demo role selector is a frontend UAT convenience. It must not be used as production authentication because:

- It is not tied to verified identity.
- It does not prove real user role assignment.
- It does not enforce backend/RLS permissions.
- It could create a false sense of production security.

## Safe Retirement Criteria

The demo selector can be retired when:

- Production authentication provider is configured.
- User profile role source is available.
- Each user has an approved role assignment.
- Backend/RLS policies enforce role permissions.
- Admin / Controller signs off role visibility.
- Warehouse and accounting users complete access verification.
- Tests pass after removal or production disablement.

## Replacement Requirement

The replacement must use:

- Authenticated user identity
- Approved profile or role assignment source
- Viewer fallback for missing or invalid roles
- Explicit admin assignment
- Backend/RLS enforcement

## Role Assignment Source

Production role assignment should come from a trusted user profile or approved identity/role mapping source.

The frontend should consume the resolved role but must not be the source of truth for production access control.

## Testing Requirement

Before retirement:

- Verify each role can access expected routes.
- Verify restricted routes are blocked.
- Verify invalid or missing role falls back to viewer.
- Verify admin is never granted by default.
- Verify accounting review remains read-only.
- Verify warehouse roles do not see accounting-only review cards unless approved.

## Rollback Approach

If production auth rollout causes blocking access issues:

1. Stop affected rollout activity.
2. Capture user, role, environment, and evidence.
3. Restore previous approved release or config if required.
4. Keep the demo selector disabled for production unless explicitly approved for controlled troubleshooting outside production data.
5. Record defect and retest with corrected role assignment.

## Sign-off Requirement

Retirement requires sign-off from:

- Admin / Controller
- IT / Technical
- Warehouse Manager
- Accounting
- Business Owner
