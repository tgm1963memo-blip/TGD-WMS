# Phase 23R: Fix Receiving Draft UUID RPC Response Mapping

## Objective
Normalize the Supabase RPC response for `tgd_rpc_create_receiving_draft` so that the returned draft ID (whether a direct UUID string or an object) is safely parsed and used within the frontend `ReceivingCreatePage`.

## Technical Details

### Master Table Constraints
- **Actual Document Table**: `public.tgd_receiving_documents`
- **Actual Line Table**: `public.tgd_receiving_lines`
- **Non-Existent Table**: There is no `public.tgd_receiving_headers` table. The term "document" is used appropriately within the application to map to `tgd_receiving_documents`.

### RPC Behavior
The RPC `tgd_rpc_create_receiving_draft` returns a direct UUID (`uuid`). Previously, the frontend expected a nested object or array shape, resulting in `getCreatedDocumentId` returning an empty string. This caused the UI to throw a `DRAFT_ID_MISSING` error and disable "Add Line".

### Fix Implementation
1. **Response Normalizer**: Created `normalizeReceivingDocumentId(data)` in `src/services/receivingService.js`.
   - Handles `string` (direct UUID)
   - Handles `Array` (extracts from first element, supports `.id`, `.document_id`, etc.)
   - Handles `Object` (supports `.id`, `.document_id`, etc.)
2. **Service Mapping**: `createReceivingDocument` now uses the normalizer to ensure the returned data is uniformly packaged as `{ data: { id, document_id }, error: null }`.
3. **Frontend Simplification**: `ReceivingCreatePage.jsx` now simply reads `result.data?.id || result.data?.document_id`.

## Safety Boundaries Maintained
- No direct stock balance updates occur.
- No movement ledger bypass occurs.
- The root cause of `DRAFT_ID_MISSING` was strictly an API response mapping issue, not a business logic flaw.
- Production state remains **HOLD**.
- FINAL GO is **NOT AUTHORIZED**.
