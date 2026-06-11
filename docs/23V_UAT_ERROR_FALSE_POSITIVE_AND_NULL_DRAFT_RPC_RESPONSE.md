# Phase 23V: UAT Error False Positive and Null Draft RPC Response

## False Positive Root Cause

The UAT body scanner treated the diagnostic line
`Save draft RPC error: None` as a real error because its generic phrase list
includes `error:`.

The detector now removes only complete safe diagnostic lines:

- `Save draft RPC error: None`
- `RPC error: None`

Real RPC errors are still detected, including permission denied, function not
found, and invalid input syntax messages. Production HOLD and FINAL GO warning
phrases continue to use their existing expected-warning handling.

## Receiving RPC Diagnostics

The current UAT state is `rpcCalled: true`, but the RPC response is null or
undefined and no draft id is available. Diagnostics distinguish:

- RPC not called
- RPC called with a `null` response
- RPC called with an `undefined` response
- RPC called with a direct UUID response
- RPC called with an error

The actual `tgd_rpc_create_receiving_draft` RPC returns `uuid`. A direct UUID
response remains supported and maps to `{ id: uuid, document_id: uuid }`.
Null and undefined responses are never converted into a fake id.
`DRAFT_ID_MISSING` remains **BLOCKED**.

## Safety Boundaries

- No direct insert into `tgd_receiving_documents` is performed.
- No direct stock update is performed.
- No movement ledger bypass is allowed.
- Production remains **HOLD**.
- **FINAL GO is NOT AUTHORIZED**.
