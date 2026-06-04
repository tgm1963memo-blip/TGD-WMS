# 14V Controlled Pick Confirmation UI Draft

Sprint **14V** adds a controlled pick confirmation UI draft to `/operations/picking-draft`. Migration **029** and RPC `tgd_rpc_confirm_outbound_pick_draft` were applied to **Staging only** in sprint **14U** (CLOSED/PASS, commit `4edb395`).

This sprint is **UI draft, validation, docs, and tests only**.

---

## Scope

- **UI draft** on `/operations/picking-draft` — "Controlled Pick Confirmation Draft" section
- Calls `confirmOutboundPickDraft` from `outboundPickingService` only
- **No migration** in sprint 14V
- **No Production touched**
- **No Post Outbound**
- **No Confirm Stock Out**
- **No delete/truncate**
- **No stock_movement OUT**
- **No stock_balance update**
- **No stock movement service** or **stock balance mutation service** calls

### Confirm pick behavior

Confirm pick updates **outbound picking state only** (documents, lines, reservations). Physical stock issue remains deferred to a future Post Outbound sprint.

---

## UI section

Route: `/operations/picking-draft`

Section title: **Controlled Pick Confirmation Draft**

Safety note:

> Confirm Pick updates outbound picking state only. No stock posting. No stock movement OUT. No stock balance update.

Inputs:

| Field | Notes |
|-------|-------|
| Outbound Document ID | Read-only; populated from loaded document when available |
| Outbound Line ID | Required UUID |
| Reservation ID | Required UUID |
| Picked Quantity | Required; must be `> 0` |
| Picked Weight | Default `0`; must be `>= 0` |
| Pick Reference | Required for idempotency |
| Pick Note | Optional |

Submit button: **Save Pick Confirmation Draft** (not wired to Post Outbound or stock tables).

On success:

- Message: `Pick confirmation draft saved.`
- JSON result summary displayed
- Document detail reloaded via `getOutboundDocumentDetail`

On error:

- Message: `Unable to confirm pick draft. Please check reservation status, quantities, or permission.`
- No raw stack traces

---

## Validation rules (client-side)

Before calling `confirmOutboundPickDraft`:

| Rule | Error message |
|------|---------------|
| Document ID required and valid UUID | Existing document ID messages |
| Outbound line ID required | `Outbound line ID is required.` |
| Outbound line ID valid UUID | `Outbound line ID must be a valid UUID.` |
| Reservation ID required | `Reservation ID is required.` |
| Reservation ID valid UUID | `Reservation ID must be a valid UUID.` |
| Picked quantity > 0 | `Picked quantity must be greater than 0.` |
| Picked weight >= 0 | `Picked weight must be 0 or greater.` |
| Pick reference required | `Pick reference is required for idempotency.` |

---

## Manual smoke test plan (Staging)

Prerequisites: Staging auth session with warehouse role; migration 029 applied (14U).

1. Open `/operations/picking-draft`.
2. Load a Staging outbound document with ACTIVE reservation (`SMOKE-OUT-14F-002` or equivalent).
3. Verify safety notes render; no Post Outbound / Confirm Stock Out / Delete buttons.
4. Enter line ID, reservation ID, partial `picked_quantity`, pick reference.
5. Submit **Save Pick Confirmation Draft**.
6. Verify success message and JSON summary.
7. Verify document detail reload shows updated `picked_quantity` on line.
8. Re-submit same pick reference — expect idempotent success (14U behavior).
9. Attempt over-pick — expect friendly error message.
10. Run safety SQL: `stock_movement` count and `stock_balance` snapshot unchanged.

---

## Hard exclusions

- No `tgd_rpc_post_outbound_document`
- No insert into `tgd_stock_movements`
- No update to `tgd_stock_balances`
- No Post Outbound button
- No Confirm Stock Out button
- No delete/truncate

---

## Recommendation

**Next sprint: 14W Controlled Pick Confirmation UI Manual Smoke Test**

Execute the manual smoke plan above on Staging with business/warehouse sign-off. Production remains locked until separately approved.

---

## Hard safety rules (carry forward)

- Do NOT touch Production
- Do NOT apply migrations in 14V
- Do NOT create `tgd_rpc_post_outbound_document`
- Do NOT add Post Outbound button or Confirm Stock Out button
- Do NOT insert into `tgd_stock_movements`
- Do NOT update `tgd_stock_balances`
- Do NOT call stock movement service or stock balance mutation service
- Do NOT add delete/truncate
- UI may call `confirmOutboundPickDraft` only
