# 14J Outbound Picking List / Detail Read Model

## Scope

Sprint 14J adds read-only outbound list/detail support only.

No Production was touched. No migration was applied.

## Read Model

The outbound read model uses Supabase SELECT queries only:

- `listOutboundDocuments()` reads `tgd_outbound_documents`.
- `getOutboundDocumentDetail(documentId)` reads:
  - `tgd_outbound_documents`
  - `tgd_outbound_lines`
  - `tgd_outbound_reservations`

The UI route `/operations/outbound` shows outbound headers and selected document detail with lines and reservations.

## Safety Boundaries

- Read-only list/detail only.
- No post outbound.
- No `tgd_rpc_post_outbound_document`.
- No Post Outbound button.
- No Confirm Stock Out button.
- No stock_movement OUT.
- No insert into `tgd_stock_movements`.
- No stock_balance update.
- No update to `tgd_stock_balances`.
- No stock movement service call.
- No stock balance mutation service call.
- No delete/truncate behavior.
- No Production touched.
- No migration applied.

## Deferred

Stock decrease remains a later controlled sprint. Outbound posting and physical stock movement must be introduced only through a separately approved controlled sprint.
