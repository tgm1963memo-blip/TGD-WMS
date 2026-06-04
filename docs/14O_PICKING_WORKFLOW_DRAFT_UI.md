# 14O Picking Workflow Draft UI

Sprint 14O adds a safe picking draft workflow UI foundation for UAT readiness.

## Scope

- Picking draft workflow only.
- Uses outbound document detail as a read model.
- Reads outbound document, line, and reservation data through `getOutboundDocumentDetail`.
- Manual picking note is local-only and is not saved to the database.
- No migration applied.
- No Production touched.

## Route

- `/operations/picking-draft`

The sidebar exposes:

- Picking Draft / ทดลองหยิบสินค้าแบบร่าง

The page links back to:

- `/operations/outbound`

## Safety Boundaries

- No post outbound.
- No `tgd_rpc_post_outbound_document`.
- No stock_movement OUT.
- No stock_balance update.
- No insert into `tgd_stock_movements`.
- No update to `tgd_stock_balances`.
- No stock movement service call.
- No stock balance mutation service call.
- No delete/truncate.

## UI Behavior

- Shows safety note: `Picking draft workflow only. No stock posting. No stock movement OUT. No stock balance update.`
- Loads outbound document detail by `document_id`.
- Displays outbound document fields.
- Displays outbound lines as read-only picking candidates.
- Displays reservation status and location alongside each line where available.
- Provides a local-only manual note for UAT preparation.

## Deferred Work

- Picking confirmation remains a later controlled sprint.
- Stock-out remains a later controlled sprint.
- Posting outbound remains a later controlled sprint.
- Physical stock decrease remains disabled in this sprint.
