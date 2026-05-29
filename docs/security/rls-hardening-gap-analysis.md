# RLS Hardening Gap Analysis

## Purpose

This document identifies the expected Row Level Security (RLS) control model and policy review backlog for TGD WMS before production rollout.

This is an audit and planning document only. It does not create or modify database policies.

## Tables To Review

### Master Data Tables

- Customers
- Products / SKUs
- Warehouses
- Rooms / zones / locations
- Lots
- Pallets
- UOM and status reference tables where applicable

### Inventory Movement Ledger

- Inventory movement records
- Movement reference records
- Report-facing movement views

### Stock Balance Tables

- Stock balance records
- Customer-owned inventory balance views
- Lot, pallet, warehouse, and location balance views

### Receiving / Putaway Tables

- Receiving documents
- Receiving lines
- Putaway documents
- Putaway lines
- Handheld receiving and putaway session/scan tables where applicable

### Transfer / Adjustment / Stock Count Tables

- Transfer documents and lines
- Adjustment documents and lines
- Stock count documents and lines

### Customer Withdrawal / Picking / Dispatch Tables

- Customer Withdrawal requests and lines
- Withdrawal allocations and allocation lines
- Picking documents and lines
- Dispatch / Goods Issue documents and lines

### Report-facing Views Or Services

- Inventory Dashboard data
- Customer Stock Movement Ledger
- Customer Storage Balance Report
- Storage Aging Report
- Warehouse Operation Performance Report
- Monthly Storage Billing Summary
- Accounting Charge Review preview data

### User Profile / Role Tables

- User profiles
- Role assignment records
- Permission mapping records if present

### Audit Log Tables

- Audit event tables
- Security-related audit views

### Future Document Branding Config Tables

- Future document branding configuration
- Future logo metadata/storage references

## Existing RLS Assumptions

Current production readiness documents assume:

- Frontend guards exist but are not sufficient for backend security.
- Production RLS policies require review before full production rollout.
- Role assignment must be enforced at the database/API boundary.
- Accounting review data must remain read-only.
- Direct database access must be restricted.

## Required RLS Control Model

The production RLS model should enforce:

- Authenticated user identity
- Approved role membership
- Read/write separation by role
- Warehouse and customer data boundaries where applicable
- Restricted access to audit and configuration data
- No anonymous write access
- No frontend-controlled role trust

## Role-based Access Expectations

| Role | Read expectation | Write expectation |
| --- | --- | --- |
| admin | Broad system read access | Admin-controlled writes only |
| warehouse_manager | Warehouse operations and reports | Operational supervision writes where approved |
| warehouse_staff | Assigned operation data | Limited operation entry only |
| accounting | Reports and Accounting Charge Review | No stock mutation; review-only |
| viewer | General read-only reports | No writes |

## Customer-owned Inventory Isolation Expectation

Customer-owned inventory records should be protected so users only access data appropriate to their role and operational scope.

Review points:

- Customer balance visibility
- Movement ledger visibility
- Lot/pallet/location visibility
- Accounting review visibility
- Report aggregation behavior

## Warehouse Operation Write-control Expectation

Warehouse operation writes should be controlled by role and workflow state.

Review points:

- Receiving and Putaway draft/update rights
- Transfer and Adjustment rights
- Stock Count entry rights
- Customer Withdrawal, Picking, and Dispatch rights
- Prevention of unauthorized posting or mutation

## Accounting Review Read-only Expectation

Accounting users should be able to review:

- Monthly Storage Billing Summary
- Accounting Charge Review
- Customer Storage Balance
- Operation Charge summaries

Accounting users should not directly mutate stock, movement ledger, or warehouse workflow state unless separately approved.

## Admin-only Configuration Expectation

Future configuration tables should require admin-only write access:

- Document branding configuration
- Logo metadata or storage references
- Rate card or billing support configuration if later approved

## Audit Log Access Expectation

Audit logs should be protected:

- Admin / Controller and approved technical users may review logs.
- Warehouse users should not modify audit logs.
- Accounting users should only see audit evidence needed for review.
- Audit log write behavior should be system-controlled.

## Current Gaps

| Gap ID | Area | Gap |
| --- | --- | --- |
| RLS-GAP-001 | RLS review | Production policy coverage has not been fully validated |
| RLS-GAP-002 | Role enforcement | Frontend role guard must not be trusted as backend role source |
| RLS-GAP-003 | Customer-owned inventory | Customer and warehouse data boundaries need policy review |
| RLS-GAP-004 | Accounting review | Read-only accounting access needs backend enforcement review |
| RLS-GAP-005 | Audit logs | Audit log read/write restrictions need review |
| RLS-GAP-006 | Direct database access | Production DB access controls need confirmation |
| RLS-GAP-007 | Future config | Future branding config table policy model is not yet implemented |

## Recommended RLS Policy Backlog

1. Inventory master data read/write policy review.
2. Stock balance and movement ledger read restriction review.
3. Receiving / Putaway workflow table RLS review.
4. Transfer / Adjustment / Stock Count workflow table RLS review.
5. Customer Withdrawal / Picking / Dispatch workflow table RLS review.
6. Report-facing view access review.
7. User profile and role assignment table RLS review.
8. Audit log table access review.
9. Admin configuration table policy design for future branding configuration.
10. Production smoke test for unauthorized access attempts.
