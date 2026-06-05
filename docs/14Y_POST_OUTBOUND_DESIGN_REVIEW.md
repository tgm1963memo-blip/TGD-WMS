# 14Y Post Outbound Design Review

## A. Scope

This sprint is design review only.

- No runtime Post Outbound implementation.
- No migration applied.
- No Production touched.
- No stock_movement OUT created.
- No stock_balance update/decrease.
- No UI Post Outbound button.

## B. Current State

- Outbound draft/read-only UI exists.
- Outbound reserve/release flow exists.
- Picking draft UI exists.
- Controlled Pick RPC exists on Staging.
- Controlled Pick UI exists.
- Controlled Pick UAT/edge cases passed.
- Stock movement count remained unchanged during pick tests.
- Stock balance remained unchanged during pick tests.

## C. Proposed Future Post Outbound Concept

Future RPC idea only:

- `tgd_rpc_post_outbound_document`

This sprint does not create it. The next implementation sprint must be separately approved before any RPC, migration, UI action, stock movement, or stock balance mutation is introduced.

## D. Future Post Outbound Business Rules

Any future approved Post Outbound implementation must satisfy these business rules:

- `outbound_document_id` required UUID.
- Document must exist.
- Document must be `PICKED` or all lines must be fully picked.
- All outbound lines must have `picked_quantity >= requested_quantity` or satisfy an approved tolerance rule.
- Document with no lines cannot be posted.
- Document with no picked reservations cannot be posted.
- Already posted document must be idempotent or rejected safely.
- Posting must be atomic in one transaction.
- Posting must be auditable.
- `posted_by` and `posted_at` should be recorded.
- `post_reference` should be required for idempotency.
- Stock movement source references must include `document_id`, `line_id`, `reservation_id`, `lot_id`, `product_id`, and `location_id`.
- One outbound stock movement must not be duplicated for the same reservation/post_reference.
- stock_balance must never go negative.
- If stock is insufficient at post time, post must reject.

## E. Future Stock Movement Design

Only the future approved Post Outbound sprint may:

- Create stock_movement OUT.
- Decrease stock_balance.

Proposed movement type:

- `PICK_CONFIRM` or `OUTBOUND_POST`, depending on the current movement taxonomy.

Future stock movement creation must require:

- Quantity decrease equals `picked_quantity`.
- Weight decrease equals `picked_weight` where applicable.
- `product_id`, `lot_id`, and `location_id` from reservation.
- Audit trail.
- Source document references.
- Idempotency key.

## F. Future stock_balance Design

Future stock_balance mutation must follow these rules:

- Update only via controlled RPC.
- Validate current balance >= picked quantity.
- Decrease quantity/weight atomically.
- Reject negative balance.
- No manual update.
- No direct UI update.

## G. Idempotency Design

- `post_reference` required.
- Unique reference per document/post operation.
- Replay with the same reference returns the same result or a safe idempotent response.
- Replay with a different reference after posted must reject.
- No duplicate stock movements.

## H. Reversal / Rollback Concept

- No physical delete.
- Reversal must be a separate controlled RPC.
- Reversal creates opposite movement, not manual edit.
- Only authorized roles may reverse.
- Full audit log is required.
- Rollback plan must be defined before Production.

## I. Permission/RLS Design

- Only authorized warehouse roles can post.
- Customer-scoped users cannot post unless explicitly allowed.
- Unauthenticated users must be rejected.
- RLS/grants must not expose unsafe writes directly.

## J. Safety SQL Checklist

Read-only SQL for future verification:

```sql
-- Verify no post outbound RPC exists now.
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_post_outbound_document';

-- Capture stock_movement count before/after this design sprint.
select count(*) as stock_movement_count
from public.tgd_stock_movements;

-- Capture stock_balance totals before/after this design sprint.
select
  count(*) as stock_balance_rows,
  coalesce(sum(quantity_on_hand), 0) as total_quantity_on_hand
from public.tgd_stock_balances;

-- Verify no unsafe grants on stock tables for frontend roles.
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('tgd_stock_movements', 'tgd_stock_balances')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

UI/source review for this sprint:

- Verify no UI route/button contains Post Outbound in this sprint.
- Verify no Confirm Stock Out action exists.
- Verify no stock movement service is called.
- Verify no stock balance mutation service is called.

## K. UAT / Approval Gate Before Implementation

Before any implementation sprint:

- Controlled Pick UAT passed.
- Post Outbound design approved by business owner.
- Warehouse manager approval received.
- Accounting/finance approval received if stock valuation is affected.
- Rollback owner identified.
- Staging-only apply plan approved.
- Smoke data identified.
- Production explicit FINAL GO required later.

## L. Recommendation

Recommended next sprint:

- 14Z Post Outbound RPC Draft.

Constraints for 14Z:

- Migration draft only first.
- No Staging apply until a separate approval gate.
- No UI Post Outbound button.
- No Production.
- Explicit stock mutation safety tests required.
