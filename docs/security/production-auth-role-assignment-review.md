# Production Auth Role Assignment Review

## Purpose

This document defines the production authentication and role assignment review needed before TGD WMS full production rollout.

## Current Role Model

Approved application roles:

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

The roles support Cold Storage warehouse operation, customer-owned inventory review, Customer Withdrawal workflows, Dispatch / Goods Issue, Monthly Storage Billing Summary, and Accounting Charge Review.

## Required Production Authentication Model

Production authentication should provide:

- Unique named user accounts
- Secure sign-in and sign-out
- Role assignment controlled by Admin / Controller or approved administrator
- User deactivation process
- Environment separation between staging and production
- Audit trail for important access and role changes

## Demo Role Selector Limitation

The demo role selector is useful for UAT visibility checks only. It is not production authentication and must not be treated as a security control.

Before full production:

- Disable or remove demo-only role switching.
- Connect role assignment to authenticated user identity.
- Verify that backend access control enforces assigned roles.

## Production Role Assignment Expectation

| Role | Assignment expectation |
| --- | --- |
| admin | Restricted to approved administrators only |
| warehouse_manager | Assigned to warehouse supervisors or managers |
| warehouse_staff | Assigned to warehouse operators based on duty |
| accounting | Assigned to accounting users responsible for review |
| viewer | Assigned to users needing read-only visibility |

## Admin Role Control

Admin access must be tightly controlled:

- Assign only to named approved users.
- Review periodically.
- Remove immediately when no longer required.
- Ensure admin access is not shared.

## Warehouse Manager Role Expectation

Warehouse Manager should:

- Review and supervise warehouse operations.
- Review operational evidence and reports.
- Support defect triage for warehouse workflows.
- Not bypass backend controls.

## Warehouse Staff Role Expectation

Warehouse Staff should:

- Access only assigned warehouse operation areas.
- Execute receiving, putaway, transfer, count, picking, and dispatch tasks as approved.
- Not access accounting-only review functions.

## Accounting Role Expectation

Accounting should:

- Review Monthly Storage Billing Summary.
- Review Accounting Charge Review data.
- Confirm review-only behavior.
- Not post accounting entries from TGD WMS.
- Not generate invoices from TGD WMS.

## Viewer Role Expectation

Viewer should:

- Access approved read-only reports.
- Have no warehouse operation write access.
- Have no accounting handoff or configuration write access.

## Role Verification Checklist

| Check ID | Role | Verification step | Expected result | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| AUTH-ROLE-001 | admin | Sign in as admin | Admin sees approved full navigation | Not Started |  |
| AUTH-ROLE-002 | warehouse_manager | Sign in as warehouse_manager | Warehouse operation and reports are visible | Not Started |  |
| AUTH-ROLE-003 | warehouse_staff | Sign in as warehouse_staff | Assigned operation areas visible; accounting review hidden | Not Started |  |
| AUTH-ROLE-004 | accounting | Sign in as accounting | Monthly Storage Billing Summary and Accounting Charge Review visible | Not Started |  |
| AUTH-ROLE-005 | viewer | Sign in as viewer | Read-only reports visible; write actions hidden | Not Started |  |
| AUTH-ROLE-006 | all roles | Attempt direct restricted route access | Access denied or blocked by backend where applicable | Not Started |  |
| AUTH-ROLE-007 | admin | Review role assignment source | Role comes from production-approved identity/role store | Not Started |  |

## Risks

- Demo role selector may be mistaken for production authentication.
- Frontend route hiding may be mistaken for backend security.
- Incorrect role assignment may expose accounting or warehouse operation data.
- Shared accounts may reduce accountability.
- Missing user deactivation process may leave access open after role changes.

## Recommended Next Sprint Actions

1. Define production authentication provider and user lifecycle.
2. Disable demo role selector for production.
3. Connect roles to authenticated user profiles.
4. Verify backend/RLS enforcement for each role.
5. Create a production user access review checklist.
6. Add role assignment change audit trail if not already available.
