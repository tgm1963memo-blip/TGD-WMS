# Phase 23U: Receiving Save Draft RPC Not Called and Error Detection Fix

## Current Evidence

The latest UAT diagnostic evidence showed:

- Save draft clicked: true
- Save draft validation passed: true
- Save draft RPC called: false
- Draft id: None
- Scenario B blocked with `DRAFT_ID_MISSING`

Manual SQL verification after UAT found no new row in
`public.tgd_receiving_documents`.

The active database function is
`tgd_rpc_create_receiving_draft(p_customer_id uuid, p_document_no text)`.
The RPC returns `uuid`.

## Required Fix

After customer id and document number validation passes, the receiving page
must call `tgd_rpc_create_receiving_draft`. A direct UUID response is
normalized to both `id` and `document_id`, then stored as the draft document
id in UI state. `DRAFT_ID_MISSING` remains **BLOCKED** when no real id is
returned.

Diagnostics are version **23U** and report the click, validation result, RPC
attempt, RPC name, RPC error, raw response type and preview, normalized draft
id, draft id, document number, customer id, and Add Line disabled reason.

## Error Detection

The UAT detector ignores explicit safe diagnostic values such as
`Save draft RPC error: None` and `RPC error: None`. Actual error text after an
RPC error label remains detectable and can still fail UAT.

## Safety Boundaries

- No direct insert into `tgd_receiving_documents` is made from the frontend.
- No direct stock update is performed.
- No movement ledger bypass is allowed.
- Production remains **HOLD**.
- **FINAL GO is NOT AUTHORIZED**.
