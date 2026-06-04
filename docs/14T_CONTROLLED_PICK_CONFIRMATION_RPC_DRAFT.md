# 14T Controlled Pick Confirmation RPC Draft

Sprint **14T** implements the **migration draft**, **service draft**, documentation, and safety tests recommended by sprint **14S** (CLOSED/PASS, commit `d14e00b`).

This sprint does **not** apply migrations, touch Production, add UI controls, or mutate stock.

---

## Scope

- **Migration draft only** — `database/migrations/029_tgd_wms_controlled_pick_confirmation_rpc_draft.sql`
- **No Staging apply** in sprint 14T
- **No Production touched**
- **No stock_movement OUT**
- **No stock_balance update**
- **No Post Outbound** — `tgd_rpc_post_outbound_document` is not created
- **No UI Confirm Pick button** — `/operations/picking-draft` remains read-only
- **No delete/truncate**

---

## RPC drafted

### `tgd_rpc_confirm_outbound_pick_draft`

Parameters:

| Parameter | Type | Notes |
|-----------|------|-------|
| `p_outbound_document_id` | uuid | Required |
| `p_outbound_line_id` | uuid | Required; must belong to document |
| `p_reservation_id` | uuid | Required; must belong to document and line |
| `p_picked_quantity` | numeric | Required; must be `> 0` |
| `p_picked_weight` | numeric | Default `0`; must be `>= 0` |
| `p_pick_reference` | text | Optional idempotency reference |
| `p_note` | text | Optional pick note |

Returns `jsonb` with pick status, ids, cumulative line quantities, reservation/document/line status, and `idempotent` flag.

### Service draft

`src/services/outboundPickingService.js` exports `confirmOutboundPickDraft(payload)` which calls the RPC. **Not wired to UI** in 14T.

---

## Business rules implemented in draft

- Authenticated active user profile required (`auth.uid()` + `tgd_user_profiles`)
- Warehouse roles only: `admin`, `warehouse_manager`, `warehouse_staff`
- Customer isolation when profile has `customer_id`
- Outbound document must exist and be `DRAFT` or `RESERVED`
- Outbound line must exist and belong to document
- Reservation must exist and belong to document and line
- **Reservation status must be ACTIVE** to accept a new pick
- **RELEASED reservation cannot be picked**
- **CANCELLED reservation cannot be picked**
- `picked_quantity > 0`
- `picked_weight >= 0`
- Cumulative reservation pick must not exceed `reserved_quantity`
- When `reserved_weight > 0`, cumulative pick weight must not exceed `reserved_weight`
- Line cumulative `picked_quantity` must not exceed `requested_quantity`
- Idempotent replay when reservation is **CONSUMED** and matching `pick_reference` + quantities are resubmitted
- Updates **outbound picking state only** — no stock tables

### Hard exclusions

- Does **not** insert into `tgd_stock_movements`
- Does **not** update `tgd_stock_balances`
- Does **not** create stock_movement OUT
- Does **not** decrease physical stock
- Does **not** post outbound
- Does **not** delete or truncate data

**Stock decrease belongs only to a future Post Outbound sprint** after pick confirmation UAT passes.

---

## Schema changes (draft migration 029 only)

Additive columns on `tgd_outbound_reservations`:

| Column | Type | Purpose |
|--------|------|---------|
| `picked_quantity` | numeric, default 0 | Cumulative picked qty on reservation |
| `picked_weight` | numeric, default 0 | Cumulative picked weight on reservation |
| `picked_at` | timestamptz | Pick timestamp |
| `picked_by` | uuid | Authenticated picker |
| `pick_reference` | text | Optional idempotency key |
| `pick_note` | text | Optional note |

Partial unique index: `(id, pick_reference)` where `pick_reference` is non-empty.

Existing columns reused (migration 025):

- `tgd_outbound_lines.picked_quantity`, `picked_weight`
- Reservation status `CONSUMED` used when reservation fully picked (no new enum values in 14T)

Deferred to future migration review:

- Document status `PICKING` / `PICKING_READY`
- Line status `PARTIALLY_PICKED`
- Reservation status `PICKED_PARTIAL`

---

## State transitions (draft behavior)

| Entity | Transition |
|--------|------------|
| Reservation | `ACTIVE` → `ACTIVE` (partial) or `CONSUMED` (full pick) |
| Line | `OPEN`/`RESERVED` → `RESERVED` (partial) or `PICKED` (full) |
| Document | `DRAFT`/`RESERVED` → `RESERVED` (partial) or `PICKED` (all lines picked) |

Release path unchanged: `ACTIVE` → `RELEASED` via existing release RPC.

---

## Safety SQL checklist (future Staging apply)

Run **SELECT-only** before and after apply. Do not run against Production until approved.

### Confirm pick RPC exists after apply

```sql
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_confirm_outbound_pick_draft';
```

### Post outbound RPC still absent

```sql
select n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_post_outbound_document';
```

Expected: **zero rows**.

### Stock movement count unchanged by pick smoke

```sql
select count(*) as stock_movement_count from public.tgd_stock_movements;
```

### Stock balance snapshot unchanged by pick smoke

```sql
select product_id, lot_id, location_id, quantity, weight, updated_at
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 20;
```

### Reservation pick columns present after apply

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tgd_outbound_reservations'
  and column_name in (
    'picked_quantity', 'picked_weight', 'picked_at',
    'picked_by', 'pick_reference', 'pick_note'
  )
order by column_name;
```

### Outbound grants remain SELECT-only for authenticated

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
  and grantee = 'authenticated'
order by table_name, privilege_type;
```

---

## UAT gate before Staging apply

| Criterion | 14T status |
|-----------|------------|
| Migration draft reviewed | Required |
| Picking draft UI smoke (14R) | Passed |
| Validation UX smoke (14R) | Passed |
| Business owner approval | Pending |
| Warehouse manager approval | Pending |
| Controller approval for Staging apply | Pending |
| Rollback owner identified | Required |
| Staging test data | `SMOKE-OUT-14F-002`, `SMOKE-UI-14I-001` |

---

## Recommendation

**Next sprint: 14U Controlled Pick Confirmation Staging Apply & RPC Smoke**

Apply migration 029 to Staging **only after Controller approval**. Smoke-test `tgd_rpc_confirm_outbound_pick_draft` via service wrapper or SQL — still **no stock_movement OUT**, **no stock_balance update**, **no UI Confirm Pick button** until a separately approved UI sprint.

Post Outbound and physical stock decrease remain deferred to a later sprint.

---

## Hard safety rules (carry forward)

- Do NOT touch Production
- Do NOT apply migrations without Controller approval
- Do NOT create `tgd_rpc_post_outbound_document`
- Do NOT add Post Outbound button or Confirm Stock Out button
- Do NOT insert into `tgd_stock_movements`
- Do NOT update `tgd_stock_balances`
- Do NOT call stock movement service or stock balance mutation service
- Do NOT add delete/truncate
- Do NOT add UI Confirm Pick button in 14T
