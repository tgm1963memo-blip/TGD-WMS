# 13J-AK Receiving Detail Polish

## AJ Confirmed Result Summary

13J-AJ passed on Staging through the Receiving UI runtime Confirm/Post path.

- Document ID: `588b8815-3c49-4b12-8d8e-a765f7e55f24`
- Document No: `AH-UI-RECEIVING-DRAFT-001`
- Document status: `CONFIRMED`
- Movement ID: `a028c2a8-59fd-4e1f-ab66-5399c0b2774b`
- Movement quantity: `3`
- Movement source document ID: `588b8815-3c49-4b12-8d8e-a765f7e55f24`
- Stock balance quantity moved from `1016` to `1019`
- Stock balance `last_movement_id` became `a028c2a8-59fd-4e1f-ab66-5399c0b2774b`

## What AK Adds

13J-AK polishes the Receiving Detail experience after Confirm/Post.

- Clear navigation back to the receiving list.
- Clear navigation to create another receiving draft.
- Document number and status are visible near the top of the detail page.
- Confirm/Post panel distinguishes `DRAFT`, `CONFIRMED`, and other statuses.
- Detail refresh reloads data without posting again.
- Line display shows line count and operational identifiers.
- Confirmed documents show their stock movements in a read-only section.

## Read-Only Movement Display Rule

The movement section uses `getReceivingStockMovements(documentId)` from the receiving service.

The function reads `public.tgd_stock_movements` with SELECT only, filtered by:

- `source_module = 'RECEIVING'`
- `source_document_id = documentId`

The UI displays movements only after the document is `CONFIRMED`. Draft documents show: `No stock movement until Confirm/Post`.

## Confirm/Post Wrapper-Only Rule

Receiving Detail continues to call `postReceivingDocument(document.id)` only.

The UI must not call `tgd_rpc_post_receiving_document` directly and must not call Supabase directly.

## No Direct Stock Mutation

13J-AK does not add direct stock movement writes, stock balance writes, table DML, or manual posting behavior.

The UI contains no direct `supabase.from`, `.insert`, `.update`, `.delete`, `.upsert`, or `.rpc` calls.

## Production Locked

Production remains locked for this sprint.

13J-AK does not run SQL, apply migrations, insert movements manually, update stock balances manually, or touch Production.
