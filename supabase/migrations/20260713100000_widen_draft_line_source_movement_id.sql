-- tgd_billing_invoice_draft_lines.source_movement_id was a raw uuid column,
-- but the Billing Movement Weight report (BillingMovementWeightReportPage.jsx)
-- now merges rows from three sources with composite string ids —
-- `deposit-<lineId>` / `withdrawal-<lineId>` (movementLedgerReportService.js)
-- and `opening-<lineId>-asof-<date>` (getStorageOpeningBalanceRows) — none
-- of which are valid raw UUIDs. Clicking "Create Draft" on any such row
-- failed with `invalid input syntax for type uuid: "deposit-<uuid>"` the
-- moment the insert reached this column. Widening to text preserves every
-- existing (genuinely UUID-shaped) value and both indexes rebuild
-- automatically against the new column type.

begin;

alter table public.tgd_billing_invoice_draft_lines
  alter column source_movement_id type text using source_movement_id::text;

commit;
