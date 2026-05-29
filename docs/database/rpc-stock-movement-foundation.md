# RPC Stock Movement Foundation

**Purpose**

Provide a prepared set of Supabase RPC (remote procedure call) functions that encapsulate all stock‑movement write operations. The RPC layer is the authoritative gateway for creating entries in the `tgd_stock_movements` ledger, ensuring business rules, authentication, and audit logging are enforced before any stock balance changes are applied.

---

## Movement Ledger Principle

- The **Movement Ledger** (`tgd_stock_movements`) is the single source of truth for every inventory transaction (Goods Deposit / Receiving, Putaway, Transfer, Adjustment, Picking, Dispatch, etc.).
- Front‑end applications must never write directly to `tgd_stock_balances`; they must call an RPC which writes to the ledger.

---

## Stock Balance Snapshot Principle

- `tgd_stock_balances` holds a **snapshot** of current inventory quantities. **Stock balance** is a **controlled snapshot**.
- Direct frontend stock balance update is prohibited.
- This sprint does **not** implement the snapshot update; RPC functions only insert into the ledger.

---

## Front‑end Direct Stock Update Block

- Direct `INSERT/UPDATE/DELETE` on `tgd_stock_balances` from the client is **prohibited**.
- All stock‑changing actions must go through the prepared RPC functions.

---

## RPC Responsibility

- Validate the caller’s authentication (`auth.uid()`).
- Verify an active user profile exists in `tgd_user_profiles`.
- Enforce role‑based permissions (admin, warehouse_manager, warehouse_staff).
- Enforce customer‑scoped isolation for non‑internal users.
- Validate movement type and required fields (quantity, customer_id, etc.).
- Insert a row into `tgd_stock_movements`.
- Create an audit‑log entry (planned, see comment).
- **Do not** modify `tgd_stock_balances` – that is deferred to Sprint 13H.

---

## Authentication Requirement

- RPC functions must call `auth.uid()` and ensure it is non‑null.
- If `auth.uid()` is null, the function raises an exception.

---

## Role Requirement

- Allowed roles: `admin`, `warehouse_manager`, `warehouse_staff`.
- Roles `accounting` and `viewer` are **not** permitted to create stock movements.

---

## Customer Isolation Requirement

- For users with a non‑null `customer_id` in `tgd_user_profiles`, the movement’s `customer_id` must match the profile’s `customer_id`.
- Internal roles (`admin`, `warehouse_manager`) may operate across customers.

---

## Movement Type Model

| Movement Type | Description |
|---------------|-------------|
| `RECEIVE_CONFIRM` | Goods received from a customer (deposit). |
| `PUTAWAY_CONFIRM` | Placement of received goods into storage locations. |
| `TRANSFER_CONFIRM` | Movement of inventory between storage locations. |
| `ADJUSTMENT_CONFIRM` | Manual stock adjustment (e.g., recount, damage). |
| `PICK_ALLOCATE` | Allocation of inventory to a withdrawal request. |
| `PICK_CONFIRM` | Confirmation that items have been picked. |
| `DISPATCH_CONFIRM` | Goods issued to a customer (withdrawal). |

---

## Required Validations

1. **Auth check** – `auth.uid()` must be present.
2. **Active profile** – `tgd_user_profiles` row where `auth_user_id = auth.uid()` and `is_active = true` must exist.
3. **Role check** – profile `role_name` must be one of the allowed roles.
4. **Movement type** – must be one of the listed types above.
5. **Quantity** – must be a positive integer (or numeric) where applicable.
6. **Customer ID** – required for customer‑scoped users and must match the profile’s `customer_id`.
7. **Audit log** – an audit‑log entry should be created (commented for future implementation).

---

## Audit Logging Model

- Each RPC call should record an entry in `tgd_audit_logs` with details:
  - `action` (e.g., `stock_movement_create`)
  - `performed_by` (`auth.uid()`)
  - `timestamp`
  - `details` (JSON with movement ID, type, quantity, etc.)
- The actual `INSERT` is left as a comment placeholder for future Sprint 13H implementation.

---

## Transaction Boundary

- The function runs within a single transaction (`BEGIN … COMMIT`). All checks and the ledger insert must succeed together; otherwise the transaction aborts.

---

## Future Trigger Dependency

- A **trigger** will later watch `tgd_stock_movements` and update `tgd_stock_balances` accordingly (planned for Sprint 13H).

---

## Future Staging Apply Plan

- The SQL file will be reviewed by the Controller and then applied to a staging Supabase instance for integration testing.
- No changes will be pushed to production until all reviews and tests pass.

---

## Known Gaps (this sprint)

- No `CREATE TRIGGER` statements (deferred to Sprint 13H).
- No actual audit‑log insert implementation.
- No real stock‑balance update logic.
- No UI integration – callers must use the RPC via Supabase client libraries.

---

**Prepared only.** This file and the accompanying SQL are **not** executed against Supabase until approved.

**Do NOT run** this SQL in production without Controller sign‑off.

**Trigger not implemented** in this sprint.

**Stock balance auto‑update not implemented** in this sprint.

**UI live write not implemented** – front‑end must call the RPC functions.
