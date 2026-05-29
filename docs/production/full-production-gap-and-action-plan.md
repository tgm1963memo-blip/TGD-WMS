# Full Production Gap And Action Plan

## Purpose

This document records remaining gaps, production impact, required actions, owners, target dates, and status before full production.

## Gap And Action Plan

| Gap ID | Area | Gap description | Production impact | Severity | Required before full production | Recommended action | Owner | Target sprint/date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-GAP-001 | Security / RLS | Backend/RLS final evidence must be confirmed before full production | Unauthorized access risk if not verified | High | Yes | Complete final RLS evidence review and sign-off | IT / Technical | To be filled | Open |
| PROD-GAP-002 | Authentication | Production authentication must replace or disable demo role selector | Demo role selector is not production authentication | High | Yes | Replace or disable demo role selector for production | IT / Technical | To be filled | Open |
| PROD-GAP-003 | Role assignment | Real user role assignment must be verified | Incorrect access may expose data or block users | High | Yes | Complete user-role access review | Admin / Controller | To be filled | Open |
| PROD-GAP-004 | Document branding | Branding persistence is not enabled yet | Branding draft is preview-only | Medium | No | Implement persisted branding config in future sprint | Admin / Controller | Future sprint | Open |
| PROD-GAP-005 | Document branding | Logo upload/storage is not enabled yet | Logo must use text/reference fallback | Medium | No | Implement secure storage/upload after security review | IT / Technical | Future sprint | Open |
| PROD-GAP-006 | Backup / restore | Backup/restore drill evidence must be completed before full production | Recovery readiness not proven | High | Yes | Execute approved recovery drill and attach evidence | IT / Technical | To be filled | Open |
| PROD-GAP-007 | UAT evidence | Real business UAT evidence must be attached | Business acceptance may be incomplete | High | Yes | Attach signed UAT evidence | Business Owner | To be filled | Open |
| PROD-GAP-008 | ERP connector | ERP connector remains future phase | Manual accounting handoff remains required | Low | No | Keep in backlog for future accounting handoff phase | Business Owner / IT | Future phase | Accepted limitation |
| PROD-GAP-009 | Accounting scope | Invoice generation remains explicitly out of scope | Invoices must be handled outside WMS | Low | No | Keep out of WMS production scope | Accounting | Not planned | Accepted limitation |
| PROD-GAP-010 | Accounting scope | Accounting post remains explicitly out of scope | Accounting entries must be handled outside WMS | Low | No | Keep WMS as review/handoff support only | Accounting | Not planned | Accepted limitation |
| PROD-GAP-011 | ERP scope | ERP inventory sync remains explicitly out of scope | ERP inventory transaction sync will not occur | Low | No | Keep inventory ownership in WMS and avoid ERP sync scope | Business Owner / IT | Not planned | Accepted limitation |
