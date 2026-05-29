# Stock Balance Trigger Design

**Purpose**

Provide a prepared Supabase trigger that keeps `tgd_stock_balances` in sync with the authoritative `tgd_stock_movements` ledger. The trigger updates balances whenever a new stock movement is recorded.

---

## Stock Balance Snapshot Principle

- `tgd_stock_balances` is a **controlled snapshot** of current inventory quantities per customer, product, lot, and location.
- Derived exclusively from confirmed rows in `tgd_stock_movements`.
- Front‑end applications must never modify `tgd_stock_balances` directly; they must create movements through the RPC layer (Sprint 13G) and let the trigger maintain the snapshot.

---

## Trigger Design

A **statement‑level AFTER INSERT trigger** on `tgd_stock_movements` calls a PL/pgSQL function `public.tgd_trigger_update_stock_balance()` which:
1. Locks the `search_path` to `public` to avoid accidental schema leakage.
2. Performs an **UPSERT** (`INSERT … ON CONFLICT DO UPDATE`) on `tgd_stock_balances` using the movement’s `customer_id`, `product_id`, `lot_id`, and `location_id`.
3. Adds the movement `quantity` to the existing balance (or creates a new row when none exists).
4. Returns `NULL` as required for `AFTER` triggers.

The function is created with **SECURITY DEFINER** because it must run with sufficient privileges regardless of the caller. The `search_path` is explicitly set, and all checks for `auth.uid()` and user profile are *not* needed here – the function is only invoked by the database engine after a successful RPC insertion.

---

## Security Model

- `SECURITY DEFINER` is used **only** when the `search_path` is locked to `public` and the function contains no implicit privilege escalation beyond the required tables.
- The function does **not** reference any service‑role keys or privileged environment variables.

---

## Future Steps (Sprint 13I)

- Add audit‑log entries for balance changes.
- Implement reconciliation jobs to validate snapshot integrity.
- Expose read‑only API endpoints for UI consumption of `tgd_stock_balances`.

---

**Prepared only.** This SQL file and accompanying documentation are **not** executed against any Supabase instance until explicit Controller approval.

**Do NOT run** this trigger in production without a full review and staging validation.

---

**Trigger not implemented** in this sprint (the SQL is prepared for later apply).

---

**Stock balance auto‑update not implemented** in this sprint – the trigger is the mechanism for future updates.

---

**UI live write not implemented** – the front‑end must continue using the RPC functions.

---

### Known Gap / Future Schema Requirement
- The current schema `tgd_stock_balances` does **not** include `warehouse_id` or `pallet_id`. If these columns are added in a future migration, the trigger will need to be extended to include them in the UPSERT key.

