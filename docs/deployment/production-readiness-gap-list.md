# Production Readiness Gap List

## Purpose

This gap list tracks known items that should be reviewed before expanding TGD WMS from controlled rollout to full production.

## Gap List

| Gap ID | Area | Description | Impact | Severity | Required before full production? | Owner | Target sprint | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | Security | Backend/RLS/security hardening review | Production security control must be validated beyond frontend guards | High | Yes | IT / Technical | To be assigned | Open |
| GAP-002 | Authentication | Production authentication replacement for demo role selector | Demo role selector is not production-grade access control | High | Yes | IT / Technical | To be assigned | Open |
| GAP-003 | Document Branding | Admin-editable document branding config | Branding config currently exists as foundation/preview only | Medium | No | Admin / Controller | To be assigned | Open |
| GAP-004 | Document Branding | Logo upload/storage integration | Logo is not managed through an upload/storage workflow yet | Medium | No | IT / Technical | To be assigned | Open |
| GAP-005 | UAT Evidence | Real UAT evidence completion | Business sign-off requires completed evidence and screenshots | High | Yes | Business Owner | Sprint 10E / 10F | Open |
| GAP-006 | Recovery | Production backup/restore test | Recovery procedure must be proven before full production | High | Yes | IT / Technical | To be assigned | Open |
| GAP-007 | Accounting Integration | Accounting ERP connector future phase | External accounting handoff remains manual/review-only | Medium | No | Accounting / IT | Future phase | Open |
| GAP-008 | Accounting Scope | Invoice generation explicitly out of scope | Invoices must be generated outside WMS or future approved scope | Low | No | Accounting | Not planned | Accepted limitation |
| GAP-009 | Accounting Scope | Accounting post explicitly out of scope | WMS does not post accounting entries | Low | No | Accounting | Not planned | Accepted limitation |
| GAP-010 | ERP Scope | ERP inventory sync explicitly out of scope | WMS must not sync inventory with ERP | Low | No | Business Owner / IT | Not planned | Accepted limitation |

## Review Notes

- Critical and High gaps must be reviewed in Go/No-Go decision.
- Accepted limitations must be explicitly acknowledged by business and technical owners.
- Any gap that affects stock trust, user access, or operational continuity should block full production until resolved or formally accepted.
