# 14S Picking Confirmation Design Review

Sprint **14S** is a **design review only** for controlled Confirm Pick confirmation. Sprint **14R** is **CLOSED/PASS**. Latest baseline commit: `f409bf6` — Harden picking draft validation UX.

This sprint produces documentation and safety tests only. It does **not** change application runtime code, apply migrations, or touch Production.

---

## A. Scope

- **Design review only** — no runtime Confirm Pick button, no Confirm Pick RPC implementation, no Post Outbound, no Confirm Stock Out.
- **No migration applied** in sprint 14S.
- **No Production touched**.
- **No stock posting** — no `tgd_rpc_post_outbound_document`, no insert into `tgd_stock_movements`, no update to `tgd_stock_balances`.
- **No stock_movement OUT** and **no stock_balance update**.
- **No stock movement service** or **stock balance mutation service** calls from picking confirmation design work.
- **No delete/truncate** of smoke or production data.
- Picking draft UI at `/operations/picking-draft` remains **read-only** for outbound detail, lines, and reservations; manual note stays **local-only** (not saved to the database).

---

## B. Current state

### Outbound document draft / read-only

- Outbound draft creation, add line, reserve, and release are available through controlled draft RPCs (`tgd_rpc_create_outbound_draft`, `tgd_rpc_add_outbound_line`, `tgd_rpc_reserve_outbound_stock`, `tgd_rpc_release_outbound_reservation`) per sprint 14D.
- `/operations/outbound` and `/operations/outbound-draft` provide list, detail, and draft smoke flows without Post Outbound.
- Outbound tables are read-only for authenticated users via SELECT-only grants and RLS (14K/14K-Fix-2). No Confirm Pick or Post Outbound RPC exists in the applied baseline.

### Reservation flow

- **Create draft** → document `DRAFT`, lines `OPEN`.
- **Add line** → `requested_quantity > 0`, optional lot.
- **Reserve** → creates `tgd_outbound_reservations` with status **ACTIVE**; ties `outbound_document_id`, `outbound_line_id`, `location_id`, `reserved_quantity`, `reserved_weight`.
- **Release** → ACTIVE reservation → **RELEASED**; does not consume physical stock or change `tgd_stock_balances`.

Reservation records picking intent only. ACTIVE reservations do not decrease available stock balance.

### Picking draft UI (read-only)

- Route: `/operations/picking-draft` (14O).
- Loads outbound document detail via `getOutboundDocumentDetail` using `document_id`.
- Displays document header, outbound lines (`picked_quantity`, `requested_quantity`), and reservation status/location.
- Safety note: picking draft workflow only; no stock posting, no stock_movement OUT, no stock_balance update.
- **No Confirm Pick button**, **no Post Outbound button**, **no Confirm Stock Out button**.

### Picking draft validation UX (14Q / 14R)

- Empty `document_id` → `Outbound Document ID is required.` (no service call).
- Invalid UUID → `Outbound Document ID must be a valid UUID.` (no service call).
- Loading, not-found/permission, service error, empty lines, and empty reservations messages are user-friendly (no raw stack traces).
- Validation/error UX smoke **passed** on Staging (14R CLOSED/PASS).

### Local note

- Manual picking note on the picking draft page is **local-only** and **is not saved to the database**. There is no save action for the note.

---

## C. Proposed controlled Confirm Pick concept

### Future RPC (not created in 14S)

A future controlled RPC may be named:

`tgd_rpc_confirm_outbound_pick_draft`

**This sprint does NOT create** `tgd_rpc_confirm_outbound_pick_draft` or any Confirm Pick wrapper in migrations, services, or UI.

### Purpose (future)

- Record warehouse pick confirmation against an **ACTIVE** outbound reservation.
- Update outbound picking state on document, line, and reservation rows only.
- Stamp `picked_by` and `picked_at` for audit.
- Remain **idempotent** when the same reservation pick is submitted twice with identical quantities.

### Approval gate

The **next implementation sprint** (proposed **14T**) must be **separately approved** by business owner and warehouse manager before any migration draft, Staging apply, or UI/RPC wiring.

---

## D. Business rules for future Confirm Pick

All rules below apply to the **future** `tgd_rpc_confirm_outbound_pick_draft` implementation. None are enabled in 14S.

### Required identifiers (UUID)

- `outbound_document_id` — required, valid UUID, must exist.
- `outbound_line_id` — required, valid UUID, must belong to the document.
- `reservation_id` — required, valid UUID, must belong to the document and line.

### Quantity and weight

- `picked_quantity > 0` on every confirm call.
- `picked_weight >= 0` (default 0 when omitted).
- `picked_quantity` must **not exceed** `reserved_quantity` on the target reservation.
- Cumulative picked quantity on the line must **not exceed** `requested_quantity` on `tgd_outbound_lines`.
- Optional: `picked_weight` must not exceed `reserved_weight` when weight is tracked.

### Reservation status

- Reservation status must be **ACTIVE** to accept a pick.
- **RELEASED** reservation cannot be picked.
- **CANCELLED** reservation cannot be picked.
- **CONSUMED** (or future **PICKED**) reservations reject duplicate pick unless idempotency key matches the prior successful call.

### Document status

- Outbound document must be **DRAFT** or **PICKING_READY** (proposed enum; see section E).
- Documents in **CANCELLED**, **POSTED**, or terminal shipped states must reject pick confirmation.

### Idempotency

- Re-submitting the same `reservation_id` with the same `picked_quantity` and `picked_weight` after a successful pick must return success without double-counting line totals.
- Conflicting re-submit (different quantities after pick) must fail with a clear business error.

### Audit

- Set `picked_by` to the authenticated user (or explicit `p_completed_by` when approved for service accounts).
- Set `picked_at` to transaction timestamp (`now()` at commit).

### Explicit exclusions (hard safety)

- Confirm Pick must **not** create **stock_movement OUT**.
- Confirm Pick must **not** update **stock_balance**.
- Confirm Pick must **not** call stock movement service or stock balance mutation service.
- Confirm Pick must **not** invoke `tgd_rpc_post_outbound_document`.

---

## E. State transition design

Current schema enums (migration `025_tgd_wms_outbound_picking_foundation.sql`) differ from the target picking lifecycle. **Enum changes require a future migration review** before 14T apply.

### Reservation (proposed)

| From | Event | To |
|------|--------|-----|
| ACTIVE | Partial pick | PICKED_PARTIAL (new enum value) |
| ACTIVE | Full pick of reserved qty | PICKED (or CONSUMED — align in migration review) |
| PICKED_PARTIAL | Additional pick | PICKED |
| RELEASED | Confirm pick attempt | **Reject** |
| CANCELLED | Confirm pick attempt | **Reject** |

### Outbound line (proposed)

| From | Event | To |
|------|--------|-----|
| OPEN | First partial pick | PARTIALLY_PICKED (new enum value) |
| PARTIALLY_PICKED | More pick qty | PARTIALLY_PICKED or PICKED |
| OPEN / RESERVED | Full pick vs requested | PICKED |
| PICKED | Post outbound (later sprint) | unchanged until post |

Current line statuses: `OPEN`, `RESERVED`, `PICKED`, `SHORT`, `CANCELLED`.

### Outbound document (proposed)

| From | Event | To |
|------|--------|-----|
| DRAFT | First pick on any line | PICKING (new enum value) |
| DRAFT / PICKING_READY | Pick in progress | PICKING |
| PICKING | All lines fully picked | PICKED |
| PICKED | Post outbound (future sprint) | POSTED / CONFIRMED (separate design) |

Current document statuses: `DRAFT`, `RESERVED`, `PICKED`, `CONFIRMED`, `CANCELLED`. Introducing `PICKING_READY` and `PICKING` requires CHECK constraint migration and backfill plan.

### Migration review checklist (14T draft)

- Expand CHECK constraints on `tgd_outbound_documents.status`, `tgd_outbound_lines.status`, `tgd_outbound_reservations.status`.
- Map existing `RESERVED` document state to `PICKING_READY` if business approves rename vs additive enum.
- Document rollback: revert migration only before Staging data depends on new statuses.

---

## F. Data mutation boundary

### Confirm Pick MAY update (future 14T)

- `tgd_outbound_reservations` — status, picked quantities/weights, `picked_by`, `picked_at`.
- `tgd_outbound_lines` — `picked_quantity`, `picked_weight`, `status`.
- `tgd_outbound_documents` — `status`, `updated_at`, optional pick summary fields.

### Confirm Pick MUST NOT (14S and 14T hard boundary)

- Insert into `tgd_stock_movements` (including direction **OUT**).
- Update `tgd_stock_balances`.
- Call inventory movement / stock movement posting services.
- Call stock balance mutation services.
- Create `tgd_rpc_post_outbound_document` or expose Post Outbound in UI.

**Stock decrease belongs only to a future Post Outbound sprint** after pick confirmation is proven in Staging. Physical issue remains trigger-driven or dedicated post RPC — not part of Confirm Pick.

---

## G. Safety SQL checklist

Run in **Staging** or local Supabase SQL Editor only. **SELECT-only** — no DML, no DDL, no delete/truncate. **Do not run against Production.**

### No post outbound RPC

```sql
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_post_outbound_document';
```

Expected: **zero rows** until a separately approved post-outbound sprint creates it.

### No confirm pick RPC

```sql
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tgd_rpc_confirm_outbound_pick_draft',
    'tgd_rpc_confirm_outbound_pick'
  );
```

Expected: **zero rows** after 14S and until 14T is explicitly approved and applied.

### Stock movement count unchanged

```sql
select count(*) as stock_movement_count
from public.tgd_stock_movements;
```

Capture before and after picking draft UAT. Outbound draft, reserve, release, and picking draft UI loads must **not** change the count.

### Stock balance unchanged

```sql
select product_id, lot_id, location_id, quantity, weight, updated_at
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 20;
```

Capture snapshot before and after UAT. No row quantity/weight change from outbound read-only or picking draft flows.

### Outbound table grants: authenticated SELECT only

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Expected: **SELECT** for `authenticated` on outbound tables; no broad INSERT/UPDATE/DELETE grants to `authenticated` on stock tables from outbound/picking sprints.

### No outbound-related stock_movement OUT rows (spot check)

```sql
select id, direction, source_module, source_document_id, created_at
from public.tgd_stock_movements
where direction = 'OUT'
  and source_module ilike '%outbound%'
order by created_at desc
limit 20;
```

Use as evidence that outbound picking work has not posted physical OUT movements.

---

## H. UAT criteria

| Criterion | Status / owner |
|-----------|----------------|
| Picking draft UI smoke at `/operations/picking-draft` | **Passed** (14O/14R) |
| Validation/error UX smoke (empty UUID, not found, empty lines/reservations) | **Passed** (14Q/14R) |
| Business owner approval for 14T implementation | **Pending** — name approver before 14T |
| Warehouse manager approval for 14T implementation | **Pending** — name approver before 14T |
| Rollback owner identified | **Required** before Staging apply of 14T migration |
| Staging test data identified | `SMOKE-OUT-14F-002`, `SMOKE-UI-14I-001`, `SMOKE-UI-14I-RETEST-001` (do not delete in 14S) |

### UAT evidence to retain

- Screenshots or session notes for picking draft load, lines, reservations, and local-only note disclaimer.
- Safety SQL snapshots (stock_movement count, stock_balance sample) before/after session.
- Confirmation that no Confirm Pick, Post Outbound, or Confirm Stock Out controls appear in UI.

---

## I. Recommendation

1. **Next sprint: 14T Controlled Pick Confirmation RPC Draft** — migration **draft only** first; document enum expansions and `tgd_rpc_confirm_outbound_pick_draft` signature; no stock_movement OUT; no stock_balance update.
2. **Separate approval gate** for Staging migration apply (business owner + warehouse manager + rollback owner).
3. **Defer Post Outbound** to a later sprint after pick confirmation UAT passes; stock decrease remains Post Outbound only.
4. **Do not** add Confirm Pick button, Post Outbound button, or Confirm Stock Out button until 14T RPC and permissions are reviewed.
5. **Next implementation sprint must be separately approved** — 14S does not authorize runtime or migration execution.

### Hard safety rules (carry forward)

- Do NOT touch Production.
- Do NOT apply migrations in 14S.
- Do NOT create `tgd_rpc_post_outbound_document`.
- Do NOT add Confirm Pick button (until approved 14T+ UI sprint).
- Do NOT add Post Outbound button or Confirm Stock Out button.
- Do NOT insert into `tgd_stock_movements`.
- Do NOT update `tgd_stock_balances`.
- Do NOT call stock movement service or stock balance mutation service.
- Do NOT add delete/truncate.

---

**Sprint 14S outcome**: Controlled picking Confirm Pick design is documented and guarded by unit safety tests. Physical stock issue remains out of scope until a future Post Outbound sprint.
