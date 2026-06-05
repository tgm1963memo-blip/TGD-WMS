# 14Z Post Outbound RPC Draft

## Scope

- Migration draft only.
- No Staging apply in this sprint.
- No Production touched.
- No UI Post Outbound button.
- No Confirm Stock Out button.
- No frontend stock movement service call.
- No frontend stock balance mutation service call.

Future RPC name drafted in migration `030_tgd_wms_post_outbound_rpc_draft.sql`:

- `public.tgd_rpc_post_outbound_document(p_outbound_document_id uuid, p_post_reference text, p_note text default null)`

## Business Rules Drafted

The draft RPC implements or enforces these future rules:

- Authenticated active user required.
- Authorized warehouse role required: `admin` or `warehouse_manager`.
- `outbound_document_id` required.
- `post_reference` required.
- Document must exist.
- Document must have at least one line.
- Document must be `PICKED` before posting.
- Every non-cancelled outbound line must be fully picked with `picked_quantity >= requested_quantity`.
- Document with no picked reservations cannot be posted.
- Picked reservations must have `product_id`, `lot_id`, and `location_id`.
- Already posted document with the same `post_reference` returns an idempotent safe result.
- Already posted document with a different `post_reference` rejects.
- Posting runs in one database transaction.
- `posted_by`, `posted_at`, `post_reference`, and `post_note` are recorded.
- Movement source references include document, line, reservation, product, lot, location, and post reference.
- Duplicate stock movements for the same reservation/post_reference are blocked.
- `stock_balance` must never go negative.
- Insufficient stock at post time rejects before any movement insert.
- Total movement quantity equals picked reservation quantities.
- Audit is recorded in `tgd_audit_logs` when the table exists.

## Schema Changes Drafted

Safe additive columns:

- `tgd_outbound_documents.post_reference`
- `tgd_outbound_documents.post_note`
- `tgd_outbound_reservations.posted_quantity`
- `tgd_outbound_reservations.posted_weight`
- `tgd_outbound_reservations.posted_at`
- `tgd_outbound_reservations.posted_by`
- `tgd_outbound_reservations.post_reference`
- `tgd_outbound_reservations.post_note`
- `tgd_stock_movements.source_reservation_id`
- `tgd_stock_movements.source_reference`

The existing outbound document status constraint already includes `CONFIRMED`, so the draft uses `CONFIRMED` as the posted state and does not change the status enum/check constraint.

## Movement / Balance Design

Inspection found the current movement ledger is:

- `public.tgd_stock_movements`

Inspection found the current controlled balance snapshot is:

- `public.tgd_stock_balances`

The draft uses movement type:

- `PICK_CONFIRM`

The RPC inserts one `PICK_CONFIRM` row into `tgd_stock_movements` per consumed picked outbound reservation. Each movement uses:

- `from_location_id = reservation.location_id`
- `to_location_id = null`
- `quantity = reservation.picked_quantity`
- `weight = reservation.picked_weight`
- `source_module = 'OUTBOUND_POST'`
- `source_document_id = outbound document id`
- `source_line_id = outbound line id`
- `source_reservation_id = outbound reservation id`
- `source_reference = post_reference`

The draft does not directly update `tgd_stock_balances`. It validates the current balance with `FOR UPDATE` before movement insertion and relies on the existing `tgd_trigger_update_stock_balance` trigger on `tgd_stock_movements` to deduct stock from `from_location_id`.

Current balance trigger behavior is quantity-focused. The draft records movement weight and reservation posted weight; a future apply review should confirm whether balance-level weight deduction is required for valuation/reporting before Staging apply.

## Idempotency Strategy

- `post_reference` is required.
- `tgd_outbound_documents (id, post_reference)` has a partial unique index.
- `tgd_outbound_reservations (id, post_reference)` has a partial unique index.
- `tgd_stock_movements` has a partial unique index on `(source_module, source_document_id, source_reservation_id, source_reference)` for `OUTBOUND_POST`.
- Replay after `CONFIRMED` with the same `post_reference` returns a safe idempotent result.
- Replay after `CONFIRMED` with a different `post_reference` rejects.
- Duplicate movement for the same reservation/post_reference rejects.

The older receiving unique index on `(source_module, source_document_id, source_line_id)` is re-scoped to `source_module = 'RECEIVING'` so outbound can safely post one movement per reservation even when a document line has multiple reservations.

## Rollback / Reversal

Rollback/reversal remains a future separate sprint.

- No physical delete.
- Reversal must be a separate controlled RPC.
- Reversal must create opposite movements.
- Reversal must be role-gated and audited.
- Rollback plan must be approved before Production.

## Safety SQL Checklist for Future Staging Apply

Run before and after any separately approved Staging apply:

```sql
-- Verify function exists only after applying migration 030.
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_post_outbound_document';

-- Capture movement count before/after smoke.
select count(*) as stock_movement_count
from public.tgd_stock_movements;

-- Capture balance snapshot before/after smoke.
select customer_id, product_id, lot_id, location_id, quantity, weight
from public.tgd_stock_balances
order by customer_id, product_id, lot_id, location_id;

-- Verify no negative stock balances.
select *
from public.tgd_stock_balances
where quantity < 0;

-- Verify outbound post movement source references.
select source_module, source_document_id, source_line_id, source_reservation_id, source_reference, count(*)
from public.tgd_stock_movements
where source_module = 'OUTBOUND_POST'
group by source_module, source_document_id, source_line_id, source_reservation_id, source_reference
having count(*) > 1;

-- Verify grants expose RPC only to authenticated.
select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'tgd_rpc_post_outbound_document'
order by grantee, privilege_type;
```

## Next Sprint Recommendation

Recommended next sprint:

- 15A Post Outbound RPC Staging Apply & Smoke

Only after Controller approval:

- Apply migration 030 to Staging.
- Run Staging smoke with known picked outbound data.
- Verify stock movements and stock balances.
- Verify idempotent replay.
- Keep Production locked until a later explicit FINAL GO.
