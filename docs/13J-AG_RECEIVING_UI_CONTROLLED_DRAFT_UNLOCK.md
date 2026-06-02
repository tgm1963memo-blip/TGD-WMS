# 13J-AG Receiving UI Controlled Draft Unlock

## Backend Readiness From 13J-AF

Migration 023 is applied to Staging and the receiving backend RPC contract is ready for controlled draft creation and line entry:

- `tgd_rpc_create_receiving_draft`
- `tgd_rpc_add_receiving_line` with `p_location_id`

## What The UI Is Allowed To Do

The Receiving create page may now perform controlled draft-only actions:

- Create a receiving draft using `receivingService.createReceivingDocument({ customer_id, document_no })`.
- Add receiving lines using `receivingService.addReceivingLine({ document_id, product_id, lot_id, location_id, quantity, weight })`.
- Display the draft document id, document no, and `DRAFT` status after creation.

## What Remains Locked

- Confirm/Post remains locked.
- No Confirm button is shown.
- No Post button is shown.
- `postReceivingDocument` is not imported by the Receiving create page.
- `tgd_rpc_post_receiving_document` is not called by the Receiving create page.
- No stock movement is inserted by the Receiving create page.
- No stock balance is updated by the Receiving create page.

## RPC-Only Rule

The UI must call service wrappers only. It must not use direct Supabase table writes from the page.

Forbidden in the page:

- `supabase.from`
- `.insert(`
- `.update(`
- `.delete(`
- `.upsert(`

## Production Lock

This is a Staging controlled unlock draft. Production remains locked until Controller approval.
