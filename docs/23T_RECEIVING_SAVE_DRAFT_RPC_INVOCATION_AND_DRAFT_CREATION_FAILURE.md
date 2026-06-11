# Phase 23T: Diagnose Receiving Save Draft RPC Invocation and Draft Creation Failure

## Issue Context
During Transaction UAT Round 1, Scenario B failed with `DRAFT_ID_MISSING`. However, manual SQL inspection of `public.tgd_receiving_documents` revealed that no new row was created in `tgd_receiving_documents`. This proved that the issue was not purely frontend response mapping, but rather that the RPC invocation itself failed or the draft creation transaction did not succeed.

## Resolution and Diagnostics
To accurately diagnose the failure without compromising safety boundaries, we upgraded the diagnostic panel in `ReceivingCreatePage.jsx` to version `23T`.

- We now track whether `tgd_rpc_create_receiving_draft` is actually called.
- We capture the RPC execution status, including any raw Postgres/Supabase error messages returned.
- We capture the raw response type and a safe short preview.
- The service layer `receivingService.js` now exports `diagnostics` explicitly exposing these details to the UI.
- The Playwright tests were updated to dynamically capture this diagnostic output upon failure to record it in `22N_result.json`.

## Safety Confirmations
- `DRAFT_ID_MISSING` correctly remains classified as a `BLOCKED` condition to distinguish it from application logic failures.
- No direct inserts into `tgd_receiving_documents` are made from the frontend.
- No direct stock updates or movement ledger bypasses occurred.
- Production remains **HOLD**.
- **FINAL GO is NOT AUTHORIZED**.
