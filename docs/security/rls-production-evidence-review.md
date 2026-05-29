# RLS Production Evidence Review

## Purpose

This document defines the RLS/backend security evidence required before any Full Production Go decision for TGD WMS.

TGD WMS is a Cold Storage, Storage, and Customer Withdrawal system for customer-owned inventory.

## Scope

This review covers backend security evidence for:

- RLS readiness
- Customer-owned inventory isolation
- Role-based access enforcement
- Warehouse write controls
- Accounting read-only controls
- Admin-only configuration controls
- Audit log controls
- Report access controls

This sprint is documentation-only and does not modify database schema, RLS policies, SQL, code, or production data.

## Current RLS Readiness Status

Current status: evidence required.

Known context:

- Frontend permission guards exist but are not backend security.
- Production authentication and real role assignment foundation exists.
- RLS final evidence remains open as `PROD-GAP-001`.
- Full Production Go should not proceed without backend/RLS evidence review or explicit accepted condition.

## Tables / Areas Requiring RLS Evidence

- Master data
- Inventory movement ledger
- Stock balances
- Receiving / Putaway
- Transfer / Adjustment / Stock Count
- Customer Withdrawal / Allocation / Picking / Dispatch / Goods Issue
- Reports and report-facing views/services
- Monthly Storage Billing Summary
- Accounting Charge Review
- User profile / role tables
- Audit logs
- Future document branding configuration

## Master Data Security Review

Required evidence:

- Read access rules by role.
- Admin/write access rules.
- Warehouse user access boundaries.
- Viewer read-only behavior.

Risk if missing:

- Unauthorized users may view or change customer/product/warehouse/location master data.

## Inventory Movement Ledger Security Review

Required evidence:

- Movement ledger is not directly editable by normal users.
- Ledger write path is controlled by approved backend functions/workflows.
- Read access is role-appropriate.

Risk if missing:

- Ledger could be modified, hidden, or exposed incorrectly.

## Stock Balance Security Review

Required evidence:

- Stock balances are not directly editable by frontend or unauthorized roles.
- Updates are controlled by approved inventory workflows.
- Customer-owned inventory visibility is protected.

Risk if missing:

- Customer-owned inventory quantities may become untrusted.

## Receiving / Putaway Security Review

Required evidence:

- Warehouse roles can access approved Receiving and Putaway workflows.
- Unauthorized roles cannot create or modify protected records.
- Accounting and Viewer roles remain read-only or excluded where appropriate.

## Transfer / Adjustment / Stock Count Security Review

Required evidence:

- Transfer and Stock Count write access is role-controlled.
- Adjustment access is limited to approved roles.
- Stock Count completion/variance behavior is protected.

## Customer Withdrawal / Allocation / Picking / Dispatch Security Review

Required evidence:

- Customer Withdrawal, Allocation, Picking, and Dispatch / Goods Issue access is role-controlled.
- Unauthorized users cannot mutate outbound workflow records.
- Dispatch / Goods Issue stock-impacting behavior is protected.

## Reports Security Review

Required evidence:

- Reports expose only approved data by role.
- Viewer remains read-only.
- Report data does not overexpose restricted customer-owned inventory information.

## Accounting Review Security Review

Required evidence:

- Monthly Storage Billing Summary and Accounting Charge Review are accessible to approved accounting/admin users.
- Accounting review remains read-only.
- No Accounting post or invoice action exists in WMS production scope.

## User Profile / Role Table Security Review

Required evidence:

- Only approved admin/control process can manage user roles.
- Users cannot self-assign higher roles.
- Role assignment is auditable.

## Audit Log Security Review

Required evidence:

- Audit logs cannot be edited by normal users.
- Audit log read access is restricted.
- Audit events are retained and reviewable by approved users.

## Document Branding Security Review

Required evidence:

- Current branding admin draft is preview-only.
- Future branding persistence requires admin-only controls.
- Logo upload/storage remains disabled until future security design.

## Customer-owned Inventory Isolation Review

Required evidence:

- Customer-owned inventory data access is role-appropriate.
- Customer/warehouse/location/lot/pallet visibility is controlled.
- Reports do not expose unauthorized customer-owned inventory details.

## Warehouse Write-control Review

Required evidence:

- Warehouse staff cannot write outside approved workflow scope.
- Warehouse manager controls higher-risk actions.
- Protected stock-affecting workflows are backend-controlled.

## Accounting Read-only Review

Required evidence:

- Accounting can review Monthly Storage Billing Summary and Accounting Charge Review.
- Accounting cannot mutate warehouse operations or stock balances through protected paths.

## Admin-only Configuration Review

Required evidence:

- Admin pages are restricted.
- Future persisted config must require backend/RLS admin-only write control.

## Evidence Required Before Production

- RLS enabled on sensitive tables or equivalent backend access control evidence.
- Role-based policy evidence.
- Customer-owned inventory isolation evidence.
- Movement ledger immutability evidence.
- Stock balance controlled update evidence.
- Audit log read/write control evidence.
- Report access control evidence.
- Admin-only config control evidence or future-scope limitation acknowledgement.

## Evidence Still Missing

To be completed by QA/security review:

- Actual RLS policy evidence.
- Role-by-role access test evidence.
- Protected write attempt evidence.
- Report access control evidence.
- Audit log access evidence.
- Direct database access restriction evidence.

## Risk Rating

Current risk rating before evidence attachment: High.

Reason:

- Backend/RLS evidence is required to prove frontend permissions are backed by server/database controls.

## Recommended Next Action

1. Execute non-destructive RLS/access evidence review in approved environment.
2. Complete `backend-security-evidence-checklist.md`.
3. Complete `rls-test-scenario-matrix.md`.
4. Attach evidence to production decision package.
5. Resolve or formally accept remaining risks before Conditional Go or Full Production Go.
