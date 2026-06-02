# 13J‑N Receiving Real Stock Posting RPC – Design Document

## Current stock movement schema summary

- **Table:** `public.tgd_stock_movements`
- **Key columns:**
  - `id UUID PRIMARY KEY`
  - `customer_id UUID NOT NULL`
  - `product_id UUID NOT NULL`
  - `lot_id UUID NOT NULL`
  - `from_location_id UUID` (nullable – NULL for inbound)
  - `to_location_id UUID` (nullable – NULL for outbound)
  - `quantity NUMERIC NOT NULL`
  - `weight NUMERIC`
  - `movement_type TEXT NOT NULL`
  - `movement_date TIMESTAMPTZ`, `related_document_id UUID`
  - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- **Indexes:** `idx_stock_movements_customer`, `idx_stock_movements_product`
- **Constraints:** `movement_type` check, foreign‑key references.

## Current stock balance schema summary

- **Table:** `public.tgd_stock_balances`
- **Current confirmed baseline columns:**
  - `id UUID PRIMARY KEY`
  - `customer_id UUID NOT NULL`
  - `product_id UUID NOT NULL`
  - `lot_id UUID NOT NULL`
  - `location_id UUID NOT NULL`
  - `quantity NUMERIC NOT NULL`
  - `weight NUMERIC`
  - `last_movement_id UUID`
  - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- **Unique index:** `tgd_stock_balances_customer_product_lot_location_uidx` on `(customer_id, product_id, lot_id, location_id)`
- **Guard trigger** (`guard_tgd_stock_balances_write`) prevents any direct INSERT/UPDATE/DELETE from the frontend; only internal functions may modify the table.

> **Note:** Some migration files (002) define alternative columns (`qty_on_hand`, `qty_allocated`, `qty_available`). However, the current dashboard baseline and the latest trigger (012) operate on `quantity NUMERIC`. Any migration must verify the actual stock balance columns before implementation.

## Current trigger / balance update behavior

- **Latest trigger:** `012_tgd_wms_stock_balance_trigger_direction_fix.sql` – function `tgd_trigger_update_stock_balance()`
- Fires **AFTER INSERT** on `tgd_stock_movements`.
- Uses directional logic:
  - If `from_location_id IS NOT NULL` → upsert into `tgd_stock_balances` with `-quantity` (deduction).
  - If `to_location_id IS NOT NULL` → upsert into `tgd_stock_balances` with `+quantity` (addition).
- Performs an **upsert** (`INSERT … ON CONFLICT (customer_id, product_id, lot_id, location_id) DO UPDATE`) to adjust `quantity`.
- The trigger is the single source of truth for keeping balances in sync with movements.

## Current receiving lines schema note

- **Table:** `public.tgd_receiving_lines`
- The baseline schema (001) defines the FK column as `document_id` referencing `tgd_receiving_documents(id)`.
- Migration 004 defines a more detailed receiving foundation with `receiving_document_id`, `to_location_id`, `lot_id`, `received_qty`, `uom`, `condition_status`, etc.
- The proposed RPC design uses `document_id` as the FK column name, matching the baseline schema definition. Any migration must verify the actual column name before implementation.

## Current stock movement RPC limitation

- Existing RPC `public.tgd_rpc_create_stock_movement` (see `database/rpc/005_tgd_wms_rpc_stock_movement_foundation.sql`) **requires** `product_id`, `lot_id` **and** `location_id`.
- The RPC validates these IDs, checks quantity, and inserts a row into `tgd_stock_movements`.
- Because it mandates a `location_id`, the **Receiving Confirm RPC** cannot run – the receiving flow currently only knows the receiving document/lines and does not have a location per line.

## Why the current receiving confirm RPC is blocked

The current active receiving confirm RPC is `tgd_rpc_confirm_receiving_document` (defined in `database/migrations/018_tgd_wms_receiving_rpc_contract.sql`). It is intentionally blocked with the error:
```
Receiving stock posting is not enabled until stock movement RPC accepts product_id, lot_id, and location_id
```
Without a target location the RPC cannot construct a valid `tgd_stock_movements` row, so the controller blocks execution to avoid inconsistent data.

> **Clarification:** `tgd_rpc_create_receive_movement` is an older movement dry‑run path that predates the receiving RPC contract. It must not be used by Receiving UI. The current and only receiving confirm entry point is `tgd_rpc_confirm_receiving_document`.

## Proposed new RPC

```sql
CREATE OR REPLACE FUNCTION public.tgd_rpc_post_receiving_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_doc   RECORD;
    v_line  RECORD;
    v_user  RECORD;
    v_existing_count INTEGER;
BEGIN
    -- 1. Auth & profile validation
    SELECT * INTO v_user FROM tgd_user_profiles WHERE auth_user_id = auth.uid() AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthenticated or inactive profile';
    END IF;
    IF v_user.role NOT IN ('admin','warehouse_manager') THEN
        RAISE EXCEPTION 'Only admin or warehouse_manager can confirm receiving';
    END IF;

    -- 2. Load receiving document with row lock
    SELECT * INTO v_doc FROM tgd_receiving_documents WHERE id = p_document_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receiving document not found';
    END IF;
    IF v_doc.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT documents can be confirmed';
    END IF;

    -- 3. Customer isolation check
    IF v_user.customer_id IS NOT NULL AND v_user.customer_id <> v_doc.customer_id THEN
        RAISE EXCEPTION 'Customer isolation violation';
    END IF;

    -- 4. Advisory lock to serialize per-document
    PERFORM pg_advisory_xact_lock(hashtext(p_document_id::text));

    -- 5. Duplicate posting guard – reject if movements already exist for this document
    SELECT count(*) INTO v_existing_count
      FROM tgd_stock_movements
     WHERE source_module = 'RECEIVING'
       AND source_document_id = p_document_id;
    IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'Duplicate posting detected: movements already exist for document %', p_document_id;
    END IF;

    -- 6. Process each receiving line
    FOR v_line IN SELECT * FROM tgd_receiving_lines WHERE document_id = p_document_id LOOP
        -- line-level validation
        IF v_line.product_id IS NULL OR v_line.lot_id IS NULL OR v_line.location_id IS NULL THEN
            RAISE EXCEPTION 'Line % missing product_id/lot_id/location_id', v_line.id;
        END IF;
        IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
            RAISE EXCEPTION 'Line % has invalid quantity', v_line.id;
        END IF;

        -- 6a. Insert stock movement with source reference columns
        INSERT INTO tgd_stock_movements (
            id, customer_id, product_id, lot_id, to_location_id,
            quantity, movement_type, related_document_id,
            source_module, source_document_id, source_line_id,
            created_at
        ) VALUES (
            gen_random_uuid(), v_doc.customer_id,
            v_line.product_id, v_line.lot_id, v_line.location_id,
            v_line.quantity,
            'RECEIVE_CONFIRM', p_document_id,
            'RECEIVING', p_document_id, v_line.id,
            now()
        );
    END LOOP;

    -- 7. Status only updates after all stock movement inserts succeed
    UPDATE tgd_receiving_documents
       SET status = 'CONFIRMED', confirmed_at = now()
     WHERE id = p_document_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
```
The function is an **atomic transaction** – all line inserts and the status update succeed together or none at all. Status only updates after stock posting succeeds.

## Proposed internal stock posting strategy (used by the RPC)
1. Validate `auth.uid()` and active profile.
2. Ensure caller is `admin` or `warehouse_manager`.
3. Load the receiving document with `FOR UPDATE` row lock; reject if not `DRAFT`.
4. Enforce customer isolation (profile customer matches document customer).
5. Acquire advisory lock per document to serialize concurrent attempts.
6. **Duplicate posting guard:** check `tgd_stock_movements` for existing rows matching `source_module = 'RECEIVING' AND source_document_id = p_document_id`. Reject if any exist.
7. Validate every line has **product_id, lot_id, location_id** and a positive quantity.
8. Determine target location – **Option A** (approved) stores `location_id` on each `receiving_line`.
9. Insert a `tgd_stock_movements` row per line with `movement_type = RECEIVE_CONFIRM`, including source reference columns (`source_module`, `source_document_id`, `source_line_id`).
10. After the loop, update the receiving document status to `CONFIRMED`. Status only updates after all stock movement inserts succeed.
11. Entire process runs inside a single PostgreSQL function (default atomic transaction).

## Target location decision
**Option A – add location_id to receiving_lines – APPROVED**
- Aligns with line‑level warehouse operations.
- Allows different lines of the same document to target different storage zones, shelves, or temperature rooms.
- Future extensions (partial receives, split pallets) will already have the needed data.

*Alternative options (for reference only):*
- **B – default location per customer/warehouse** – would require a lookup table and could hide mistakes.
- **C – pass a single `p_target_location_id` into the RPC** – works only for homogeneous receives.

Approved recommendation: Option A – add location_id on receiving_lines.

## Data‑integrity rules
- `quantity > 0`.
- `product_id`, `lot_id`, `location_id` must reference existing rows.
- `customer_id` on movement must match the receiving document's customer.
- Unique constraint on `tgd_stock_movements` (`id`) prevents duplicate inserts.
- Trigger on `tgd_stock_movements` guarantees balance consistency.

## RLS / privilege rules
- RLS policies on `tgd_stock_movements` and `tgd_stock_balances` already restrict reads to the owner's `customer_id` **or** admin/warehouse_manager.
- The new RPC runs **SECURITY DEFINER** with a role that has `INSERT` rights on `tgd_stock_movements` but no direct frontend writes are permitted for UI users.
- Only roles `admin` and `warehouse_manager` are allowed to call the RPC (validated inside the function).
- Customer isolation is enforced at the RPC level by comparing the caller's `customer_id` against the document's `customer_id`.

## Idempotency and duplicate posting guard

The design requires a robust duplicate posting guard to prevent dangerous re-application of movements:

1. **Row lock:** The receiving document row is locked with `SELECT ... FOR UPDATE` before any processing begins. This prevents concurrent confirm attempts on the same document.
2. **Advisory lock:** `pg_advisory_xact_lock(hashtext(p_document_id::text))` further serializes per-document access within the transaction.
3. **Status gate:** The function rejects any document where `status <> 'DRAFT'`. Since the status is changed atomically to `CONFIRMED` at the end of a successful run, a second call will fail this check.
4. **Duplicate posting guard:** Before inserting any movements, the function checks whether movements already exist for the document via the source reference columns:
   - `source_module = 'RECEIVING'`
   - `source_document_id = p_document_id`
   - `source_line_id = line.id`
   If any matching movements exist, the function raises an exception and no movements are inserted.
5. **Source reference columns on `tgd_stock_movements`:** The design requires adding three columns to `tgd_stock_movements`:
   - `source_module TEXT` – identifies the originating module (e.g. `'RECEIVING'`)
   - `source_document_id UUID` – references the originating document
   - `source_line_id UUID` – references the originating line
   If these columns do not exist yet, the migration plan must include them. Alternatively, a unique constraint on `(source_module, source_document_id, source_line_id)` can serve as a database-level guard.

> **Important:** The previous design stated that re‑running while DRAFT could re‑apply movements. This is dangerous and is explicitly rejected. The combination of row lock + advisory lock + status gate + source reference guard ensures no duplicate posting is possible.

## Rollback behavior
- If the function fails at any point, PostgreSQL rolls back the entire transaction – no partial movements remain.
- The function is **idempotent per document** because the status check (`status = DRAFT`) prevents re‑processing a confirmed document, and the duplicate posting guard prevents re‑application even in edge cases.

## Dry‑run validation plan
- Create a companion RPC `public.tgd_rpc_post_receiving_document_dry(p_document_id UUID)` that mirrors all validation steps **without** inserting rows or changing status, and returns a JSON report of any violations.
- UI (when later enabled) can call the dry‑run to show a preview of affected rows and potential errors.

## Migration plan draft (for a later sprint)
1. **Schema change – receiving_lines:** Add `location_id UUID NOT NULL` to `tgd_receiving_lines` (with foreign‑key to `tgd_locations`). Verify whether the actual FK column is `document_id` or `receiving_document_id` and align the RPC accordingly.
2. **Schema change – stock_movements:** Add source reference columns `source_module TEXT`, `source_document_id UUID`, `source_line_id UUID` to `tgd_stock_movements`. Add a unique index on `(source_module, source_document_id, source_line_id)` as a database-level duplicate posting guard.
3. **Schema verification:** Verify actual `tgd_stock_balances` columns (`quantity` vs `qty_on_hand`/`qty_allocated`/`qty_available`) and align the trigger accordingly. Any migration must verify the actual stock balance columns before implementation.
4. **Back‑fill** existing lines with a sensible default (e.g., the default receiving location for the document's warehouse).
5. **Deploy** the new RPC (`tgd_rpc_post_receiving_document`) and the dry‑run variant.
6. **Update** RLS policies if needed to expose `location_id` to privileged roles.
7. **Documentation** – add the design doc to the sprint artefacts (this file).

## Explicit non‑goals (design‑only)
- No UI changes – the Receiving page remains locked. Production locked.
- No production apply – the RPC is **not** deployed to any environment yet.
- No direct frontend writes to `tgd_stock_movements` or `tgd_stock_balances`.
- No migration execution in this sprint.
- No commit before Controller approval.

---
*Design only – no executable SQL or code changes performed.*
