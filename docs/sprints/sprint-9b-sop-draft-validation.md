# Sprint 9B SOP Draft Validation

## Summary

Sprint 9B creates SOP draft documents for warehouse operations, accounting review, role/language behavior, and incident support during UAT and training.

## Files Added/Updated

- `docs/sop/sop-overview.md`
- `docs/sop/sop-master-data.md`
- `docs/sop/sop-receiving-putaway.md`
- `docs/sop/sop-transfer-adjustment-stock-count.md`
- `docs/sop/sop-customer-withdrawal-dispatch.md`
- `docs/sop/sop-reports-accounting-review.md`
- `docs/sop/sop-role-permission-language.md`
- `docs/sop/sop-incident-and-support.md`
- `docs/sprints/sprint-9b-sop-draft-validation.md`

## SOP Coverage Status

Created. SOP coverage includes master data, inbound operations, internal operations, outbound customer withdrawal, reporting, accounting charge review, role/language behavior, and UAT incident support.

## Required Fix Status

Completed.

- Evidence / Record-keeping sections completed across SOP documents.
- Control Points terminology standardized across SOP documents.

## Warehouse Operation SOP Status

Created. Warehouse SOPs cover receiving, putaway, transfer, adjustment, stock count, customer withdrawal, allocation, picking, and dispatch / goods issue.

## Accounting Review SOP Status

Created. Accounting SOP covers Monthly Storage Billing Summary, Accounting Charge Staging Preview, Accounting Charge Handoff Review Draft, review-only behavior, and handoff assumptions.

## Role/Language SOP Status

Created. Role/language SOP covers role-based navigation, demo role selector limitation, permission denied behavior, Thai default behavior, English review, and the limitation that frontend guard is not backend security.

## Incident/Support SOP Status

Created. Incident SOP covers support process, error boundary handling, evidence collection, defect reporting, escalation levels, workaround recording, and rollback / stop-use criteria.

## Scope Check

This sprint is documentation-only. No application code, database schema, routing, permission logic, ERP connector, invoice generation, accounting posting, inventory sync, or business workflow implementation was changed.

## Forbidden Scope Check

- No `src/*` files changed.
- No `database/migrations/*` files changed.
- No `database/policies/*` files changed.
- No `legacy-reference/*` files changed.
- No `integrations/express/*` files changed.
- No `integrations/accounting-charge/adapters/*` files changed.
- No environment files changed.
- No package files changed.

## Final Status

Pending Controller Review.
