# Backend Security Evidence Checklist

## Purpose

This checklist tracks backend security and RLS evidence required before production decision.

## Checklist

| Evidence ID | Area | Security requirement | Evidence required | Current evidence status | Risk if missing | Owner | Review result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BSEC-001 | RLS enabled on sensitive tables | Sensitive tables require RLS or equivalent backend access control | Policy screenshot/export or security review evidence | Missing / Partial / Complete / Not Applicable | Unauthorized data access | IT / Technical |  |  |
| BSEC-002 | Customer-owned inventory isolation | Customer-owned inventory access must be role/warehouse/customer appropriate | Role-based read test evidence | Missing / Partial / Complete / Not Applicable | Inventory data overexposure | IT / Technical |  |  |
| BSEC-003 | User role enforcement | Backend must not trust frontend role only | Role source and backend enforcement evidence | Missing / Partial / Complete / Not Applicable | Unauthorized access | IT / Technical |  |  |
| BSEC-004 | Admin-only operations | Admin/config actions require admin-only control | Admin access test evidence | Missing / Partial / Complete / Not Applicable | Unauthorized configuration changes | Admin / Controller |  |  |
| BSEC-005 | Warehouse write operations | Warehouse writes must be limited to approved roles/workflows | Write-control test evidence | Missing / Partial / Complete / Not Applicable | Unauthorized operation changes | Warehouse Manager |  |  |
| BSEC-006 | Accounting read-only operations | Accounting review must remain read-only | Accounting role test evidence | Missing / Partial / Complete / Not Applicable | Unauthorized warehouse mutation | Accounting |  |  |
| BSEC-007 | Viewer read-only operations | Viewer must not mutate protected records | Viewer access test evidence | Missing / Partial / Complete / Not Applicable | Unauthorized modification | Admin / Controller |  |  |
| BSEC-008 | Movement ledger immutability | Movement ledger must not be directly editable by normal users | Protected update/delete test evidence | Missing / Partial / Complete / Not Applicable | Ledger trust loss | IT / Technical |  |  |
| BSEC-009 | Stock balance controlled updates | Stock balances must only change through approved workflows | Protected write evidence | Missing / Partial / Complete / Not Applicable | Stock balance trust loss | IT / Technical |  |  |
| BSEC-010 | Audit log write/read rules | Audit logs must be system-controlled and read-restricted | Audit access evidence | Missing / Partial / Complete / Not Applicable | Audit tampering or exposure | Admin / Controller |  |  |
| BSEC-011 | Public env config safety | Public frontend config must not contain secrets | Config safety evidence | Missing / Partial / Complete / Not Applicable | Secret exposure | IT / Technical |  |  |
| BSEC-012 | No service role exposure | Service role keys must never appear in frontend | Build/env review evidence | Missing / Partial / Complete / Not Applicable | Backend compromise | IT / Technical |  |  |
| BSEC-013 | No direct frontend database mutation for protected transactions | Protected transactions must not be directly mutated by frontend | Code/service review evidence | Missing / Partial / Complete / Not Applicable | Workflow bypass | IT / Technical |  |  |
| BSEC-014 | Backup/restore security acknowledgement | Backup/restore access must be controlled | Backup/restore sign-off evidence | Missing / Partial / Complete / Not Applicable | Recovery/control risk | IT / Technical |  |  |
| BSEC-015 | Report data access control | Report data must be role-appropriate | Report role test evidence | Missing / Partial / Complete / Not Applicable | Data overexposure | Admin / Controller |  |  |
