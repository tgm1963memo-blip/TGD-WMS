# 13J-AQ Receiving Audit RPC Patch

## 1. Audit Gaps Fixed
During the 13J-AP audit review, we identified that the draft RPCs managing the receiving flow were not properly recording the user identities (audit trails) when mutating the database. Migration `024_tgd_wms_receiving_audit_rpc_patch.sql` resolves these gaps by replacing the definitions of two critical RPCs.

## 2. Fields Populated
The following fields are now correctly populated using the authenticated user's profile ID (`v_profile.id`):
- **`tgd_rpc_create_receiving_draft`**: 
  - `tgd_receiving_documents.created_by`
- **`tgd_rpc_post_receiving_document`**:
  - `tgd_receiving_documents.posted_by`
  - `tgd_receiving_documents.posted_at` (set to `now()`)
  - `tgd_receiving_documents.updated_at` (set to `now()`)
  - `tgd_stock_movements.created_by` (for each inserted line)

*Note on `tgd_receiving_lines`: The `tgd_rpc_add_receiving_line` RPC was not modified since the table does not currently carry user audit fields (relying on the parent document's audit lineage instead).*

## 3. What is Unchanged
- **Trace Fields**: `source_module`, `source_document_id`, and `source_line_id` are strictly preserved on the stock movements.
- **Stock Movement Integrity**: Movement type remains `RECEIVE_CONFIRM`. Idempotency and duplicate posting guard behavior are preserved.
- **Balance Trigger Mechanism**: The migration intentionally avoids mutating `tgd_stock_balances` directly. Balance accumulation and `last_movement_id` assignment continue to be managed entirely by the `tgd_trigger_update_stock_balance` database trigger.
- **Security Posture**: Authentication, role enforcement, and customer isolation checks remain strictly enforced before any writes occur.

## 4. Environment Readiness
- **Production Locked**: This migration is a draft and has not been applied to the production database.
- **Staging Apply Required**: Before the UI can be fully unlocked for operational UAT, this patch (along with the preceding dependent drafts) must be applied to Staging via Controller approval.
