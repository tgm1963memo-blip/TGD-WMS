# 15D Post Outbound UI Draft

## Scope

- UI draft only.
- No migration applied.
- No Production touched.
- No Confirm Stock Out button.
- No manual stock movement insert.
- No manual stock balance update.
- No stock movement service call from UI.
- No stock balance mutation service call from UI.

## Feature Gate

The Post Outbound UI is controlled by:

- `VITE_ENABLE_POST_OUTBOUND_UI === 'true'`

Default behavior is disabled. When disabled, the page shows:

- `Post Outbound UI is disabled by safety gate.`

The disabled state does not show an enabled Post button.

## Controlled Service Wrapper

The UI calls only the controlled RPC wrapper:

- `postOutboundDocumentDraft(payload)`

The wrapper calls:

- `tgd_rpc_post_outbound_document`

Payload:

- `outboundDocumentId`
- `postReference`
- `note`

The UI does not call stock movement services or stock balance mutation services.

## Gating Rules

The Post Outbound Draft button is enabled only when:

- Feature gate is enabled.
- A document detail is loaded.
- Document status is `PICKED`.
- `postReference` is provided.
- Confirmation acknowledgement is checked.

If the document is not `PICKED`, the UI shows:

- `Post Outbound is available only for PICKED documents.`

If the document is already `CONFIRMED`, the UI hides the form and shows completion state.

## Validation Rules

Before calling the service wrapper:

- `outboundDocumentId` is required.
- `outboundDocumentId` must be a valid UUID.
- `postReference` is required.
- Confirmation acknowledgement is required.

Validation messages:

- `Outbound Document ID is required.`
- `Outbound Document ID must be a valid UUID.`
- `Post reference is required.`
- `Posting requires confirmation acknowledgment.`

## Confirmation Acknowledgement

The draft uses a required checkbox:

- `I understand this will create a PICK_CONFIRM movement and decrease stock balance.`

A confirmation modal remains required before Production. The modal should include document no, picked totals, movement type `PICK_CONFIRM`, stock decrease warning, and reversal boundary.

## Success UX

After successful RPC response:

- Show `Post outbound completed.`
- Show JSON/result summary.
- Reload document detail.
- Disable or hide the post form if the document becomes `CONFIRMED`.

## Error UX

On service/RPC/network error, show:

- `Unable to post outbound document. Please check document status, stock availability, reference, or permission.`

Do not expose raw stack traces.

## Manual Smoke Plan for 15E

1. Enable `VITE_ENABLE_POST_OUTBOUND_UI=true` in Staging UI configuration.
2. Load a known `PICKED` outbound document.
3. Verify picked lines and consumed reservations.
4. Enter a unique `postReference`.
5. Check the confirmation acknowledgement.
6. Submit Post Outbound Draft.
7. Confirm result JSON and document reload.
8. Verify one or more `PICK_CONFIRM` movements were created by RPC.
9. Verify stock balance decreased by picked quantity.
10. Replay the same `postReference` and confirm idempotent result.
11. Try a different `postReference` after confirmed and confirm rejection.
12. Disable the feature gate after smoke if required by Controller.

## Safety Checklist

- No direct stock edit.
- No manual stock movement insert.
- No manual stock balance update.
- Only call controlled RPC wrapper.
- No delete/truncate.
- No Production.
- Staging UI smoke required before Production consideration.

## Next Sprint Recommendation

Recommended next sprint:

- 15E Post Outbound UI Manual Smoke Test.

15E should remain Staging-only until Controller approval confirms readiness.
