# Production Gap Priority Matrix

## Purpose

This matrix classifies known production gaps for Full Production Go, Conditional Go, or deferral.

## Priority Matrix

| Gap ID | Area | Gap description | Severity | Production impact | Required before Full Production Go | Required before Conditional Go | Can defer after Go-Live | Recommended action | Owner | Target sprint | Status | Evidence required | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-GAP-001 | Security / RLS | Backend/RLS final evidence | Critical | Unauthorized access or missing backend control evidence | Yes | Yes | No | Complete final RLS/security evidence review | IT / Technical | To be filled | Open | RLS/security sign-off |  |
| PROD-GAP-002 | Authentication | Production authentication replacement or demo selector disable | Critical | Demo role selector is not production authentication | Yes | Yes | No | Replace or disable demo selector for production | IT / Technical | To be filled | Open | Auth evidence and production config review |  |
| PROD-GAP-003 | Role assignment | Real user role assignment verification | Critical | Incorrect access may expose data or block users | Yes | Yes | No | Complete user-role verification | Admin / Controller | To be filled | Open | Signed role/access review |  |
| PROD-GAP-004 | Backup / restore | Backup/restore drill execution evidence | Critical | Recovery readiness not proven | Yes | Conditional only if formally accepted | No for Full; Conditional with owner only | Execute drill or attach accepted recovery evidence | IT / Technical | To be filled | Open | Drill checklist and sign-off |  |
| PROD-GAP-005 | UAT evidence | Real business UAT evidence attachment | High | Business acceptance evidence incomplete | Yes | Conditional only if business accepts | No for Full; Conditional with sign-off only | Attach UAT evidence and sign-off | Business Owner | To be filled | Open | UAT sign-off evidence |  |
| PROD-GAP-006 | Document branding | Branding persistence not enabled | Medium | Branding admin changes are preview-only | No | No | Yes | Defer to future admin config sprint | Admin / Controller | Future sprint | Open | Limitation acknowledgement |  |
| PROD-GAP-007 | Document branding | Logo upload/storage not enabled | Medium | Logo must use fallback/reference until future sprint | No | No | Yes | Defer to future secure storage sprint | IT / Technical | Future sprint | Open | Limitation acknowledgement |  |
| PROD-GAP-008 | ERP connector | ERP connector future phase only | Low | Accounting handoff remains manual/review-only | No | No | Yes | Keep as future phase | Business Owner / IT | Future phase | Accepted limitation | Business limitation acknowledgement |  |
| PROD-GAP-009 | Accounting scope | Invoice generation explicitly out of scope | Low | Invoices handled outside WMS | No | No | Yes | Keep out of WMS scope | Accounting | Not planned | Accepted limitation | Accounting limitation acknowledgement | Restricted module |
| PROD-GAP-010 | Accounting scope | Accounting post explicitly out of scope | Low | Accounting entries handled outside WMS | No | No | Yes | Keep WMS review-only for accounting | Accounting | Not planned | Accepted limitation | Accounting limitation acknowledgement | Restricted module |
| PROD-GAP-011 | ERP scope | ERP inventory sync explicitly out of scope | Low | WMS inventory does not sync to ERP | No | No | Yes | Keep inventory ownership in WMS scope | Business Owner / IT | Not planned | Accepted limitation | Business limitation acknowledgement | Restricted module |
