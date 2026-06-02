# 13J-AE Receiving RPC Service Contract Patch (Draft)

## 13J-AD Findings
- Receiving UI remains locked (controller decision: HOLD).
- `receivingService.js` previously contained direct table writes for create/update/cancel.
- `tgd_rpc_add_receiving_line` did not accept `location_id`, preventing the frontend from supplying required location-level traceability.
- `tgd_rpc_post_receiving_document` is the validated posting RPC but posting is locked by controller decision.

## Why `location_id` is required
- Stock movement traceability requires explicit location assignment per line.
- Without `location_id` the system cannot derive accurate per-location balances or trace movements to physical locations.

## Service RPC-only strategy (Draft)
- Frontend services will be refactored to use RPCs for all write operations:
  - `tgd_rpc_create_receiving_draft(p_customer_id, p_document_no)` to create draft documents from explicit document numbers only
  - `tgd_rpc_add_receiving_line(p_location_id)` to add lines with locations
  - `tgd_rpc_post_receiving_document` to perform final posting (controller-held)
- While controller HOLD is active, frontend will not perform posting. RPC contract names are present in source for review but posting remains disabled.
- Direct `.insert()`, `.update()`, `.delete()`, `.upsert()` calls from frontend are prohibited.
- `p_reference` is not part of the draft creation RPC contract and must not be sent by `createReceivingDocument`.

## UI
- `ReceivingCreatePage` remains locked. No Save Draft button or real form submission is exposed.

## Migration
- Draft migration `database/migrations/023_tgd_wms_receiving_add_line_location_rpc_patch.sql` adds `p_location_id` parameter to `tgd_rpc_add_receiving_line` and enforces validation and role checks.
- This migration is a draft and must not be applied to production without explicit controller approval.

## Safety
- Production locked header included in migration drafts.
- No migration applied in this change.
- No commits to production assets without approval.

