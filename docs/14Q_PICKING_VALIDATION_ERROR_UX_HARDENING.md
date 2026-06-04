# 14Q Picking Validation & Error UX Hardening

Sprint 14Q hardens validation and error UX for `/operations/picking-draft`.

## Validation Scope

- Picking draft workflow page only.
- Read-only outbound document detail lookup only.
- No database mutation is added.
- No migration applied.
- No Production touched.

## Empty Document ID Behavior

If `document_id` is empty, the page shows:

`Outbound Document ID is required.`

The page does not call `getOutboundDocumentDetail` when this validation fails.

## Invalid UUID Behavior

If `document_id` is not a valid UUID, the page shows:

`Outbound Document ID must be a valid UUID.`

The page does not call `getOutboundDocumentDetail` when this validation fails.

## Loading Behavior

While loading outbound document detail, the page shows:

`Loading outbound document detail...`

The load button is disabled while the request is in progress.

## Not Found / Permission Behavior

If the read model returns no outbound document, the page shows:

`Outbound document was not found or you do not have permission to view it.`

## Service / RLS Error Behavior

If the service throws or returns an error, the page shows:

`Unable to load outbound document detail. Please check the document ID or your permission.`

The UI does not expose raw stack traces.

## Empty Lines / Reservations Behavior

If the document has no lines, the page shows:

`No outbound lines found for this document.`

If the document has no reservations, the page shows:

`No outbound reservations found for this document.`

## Local-Only Note Behavior

The manual picking note remains local-only. The page shows:

`This note is local-only and is not saved to the database.`

There is no save button for the note.

## Safety Rules

- No migration.
- No Production.
- No Confirm Pick.
- No Post Outbound.
- No Confirm Stock Out.
- No stock_movement OUT.
- No stock_balance update.
- No stock movement service call.
- No stock balance mutation service call.

Confirm picking, stock-out, and outbound posting remain later controlled sprint work.
