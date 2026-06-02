# 13J-AI Receiving Confirm/Post UI Unlock

## AH Result

Sprint 13J-AH confirmed that the Receiving UI can safely reach the controlled draft page from the Receiving list. The UI can create a receiving draft and add receiving lines with `location_id` through receiving service wrappers.

## Newly Allowed

- `ReceivingCreatePage` may show a controlled `Confirm/Post Receiving` action after a draft document exists.
- `receivingService.postReceivingDocument(id)` may call `tgd_rpc_post_receiving_document` with `p_document_id`.
- The UI may show posting progress, success, error messages, and final `CONFIRMED` status after a successful post.

## RPC-Only Rule

Confirm/Post must go through:

```text
receivingService.postReceivingDocument(id)
```

The UI component must not call `tgd_rpc_post_receiving_document` directly and must not use direct Supabase table writes.

## Duplicate Click Prevention

The `Confirm/Post Receiving` button is:

- hidden until a draft exists
- disabled while posting
- disabled after a successful post

This prevents accidental duplicate post attempts from the controlled UI.

## No Direct Stock Mutation

The UI must not manually insert stock movements, update stock balances, or reference stock tables for mutation. Any stock effect must be handled only by the approved backend RPC contract.

## Runtime Testing Still Required

Staging runtime validation is still required with an authenticated Supabase session and controlled test data. Duplicate post and invalid status behavior must be validated through the RPC response.

## Production Locked

Production remains locked. No SQL was run, no migrations were applied, and no production data was touched in this sprint.
