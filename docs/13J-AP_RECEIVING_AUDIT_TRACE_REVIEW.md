# 13J-AP Receiving Audit / Trace Review

## 1. Goal
Review the existing schema, migrations, and RPC drafts to ensure proper audit logging and traceability for the receiving flow before Production readiness. This review focuses purely on data structure and RPC logic, without touching Production or applying migrations.

## 2. Current Schema Audit Fields Discovered
From inspection of `004_receiving_foundation.sql` and `002_inventory_movement_engine.sql`:

### `tgd_receiving_documents`
- `created_at`, `updated_at` (managed by triggers)
- `created_by` (exists, references `tgd_user_profiles`)
- `posted_by`, `posted_at` (exist)
- `cancelled_by`, `cancelled_at`, `cancel_reason` (exist)

### `tgd_receiving_lines`
- `created_at`, `updated_at` (managed by triggers)
- No `created_by` or `updated_by` present.

### `tgd_stock_movements`
- `created_at`, `updated_at`
- `created_by`
- **Trace Fields (Added in 020):** `source_module`, `source_document_id`, `source_line_id`

### `tgd_stock_balances`
- `updated_at`
- **Trace Field (Added/Verified in 022):** `last_movement_id`

## 3. RPC Implementation Gaps (Migrations 018 / 020)
Reviewing `018_tgd_wms_receiving_rpc_contract.sql` and `020_tgd_wms_receiving_real_stock_posting_draft.sql`, several missing audit field assignments were discovered:

### `tgd_rpc_create_receiving_draft`
- Authenticates and loads `v_profile` (including `auth_user_id` and profile `id`), but **does not** insert `created_by` into `tgd_receiving_documents`.

### `tgd_rpc_add_receiving_line`
- Does not insert `created_by` (this is acceptable since `tgd_receiving_lines` lacks the column and lines are strongly tied to the document).

### `tgd_rpc_post_receiving_document`
- **Document Update Gap:** Updates `status = 'CONFIRMED'` and `updated_at = now()`, but **does not** set `posted_by` or `posted_at` (or `confirmed_by`/`confirmed_at` if added later).
- **Movement Insert Gap:** Inserts `tgd_stock_movements` with robust trace fields (`source_module = 'RECEIVING'`, `source_document_id = p_document_id`, `source_line_id = v_line.id`), but **does not** set `created_by` to track which user caused the movement.

## 4. Trace Fields: Sufficient & Complete
- **Stock Movement Traceability:** The `020` draft successfully populates `source_module`, `source_document_id`, and `source_line_id` for each receiving line posted.
- **Stock Balance Traceability:** The `022` draft successfully ensures the `last_movement_id` is updated on the stock balance via the `tgd_trigger_update_stock_balance` trigger.

## 5. Recommendation
The trace implementation is robust and fulfills the requirements for duplicate posting guards and lineage tracking. However, **audit logging requires patching before go-live**.

**Recommended Actions (for subsequent sprints):**
1. Update `tgd_rpc_create_receiving_draft` to populate `created_by = v_profile.id`.
2. Update `tgd_rpc_post_receiving_document` to populate `posted_by = v_profile.id` and `posted_at = now()` (or `confirmed_by` if renamed) on the document update.
3. Update `tgd_rpc_post_receiving_document` to populate `created_by = v_profile.id` when inserting into `tgd_stock_movements`.
4. Decide if `tgd_receiving_lines` needs `created_by` (optional, as the document tracks the overarching workflow).

## 6. Safety Statement
- **No Production Touched:** Schema and logic were inspected locally through existing SQL files.
- **Read-Only:** No SQL was run to mutate data. Migrations were not applied.
- **No Direct DML:** Frontend components still strictly route operations through the RPC wrappers.
