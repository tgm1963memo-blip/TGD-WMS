# Sprint 6F Implementation Notes

## Report Purpose

Sprint 6F adds the Monthly Storage Billing Summary Foundation. The report prepares read-only monthly storage billing summary previews for accounting review.

It helps answer what each customer deposited during the period, what was withdrawn, what remains in storage, which estimated chargeable weight or quantity should be reviewed, which operation charge activities are relevant, and which rows have missing data.

## Cold Storage Business Scope

TGD WMS is a cold storage deposit, storage, and customer withdrawal system. TGD stores customer-owned inventory and does not sell stored goods.

This report supports accounting review only. The WMS remains the operational system of record for warehouse activity and inventory movement.

## Customer-Owned Inventory Rule

All balances, movement quantities, storage weight previews, and operation charge activity are tied to customer-owned inventory. The report does not change inventory ownership, stock balances, movement records, or accounting state.

## Monthly Storage Billing Summary Boundary

Sprint 6F is preview/read-only only. It produces a report foundation for accounting review and does not create billable records.

## Data Sources

The report foundation is designed around:

- storage balance
- movement ledger
- storage aging / chargeable days
- storage weight snapshot preview
- operation charge preview
- rate card preview

Current UI wiring uses the existing monthly storage billing summary service, which combines storage weight preview rows and operation charge preview rows.

## Validation Warning Logic

Preview rows are classified for review. Rows can be marked ready for review or flagged for missing customer, missing rate, missing weight, or other missing data.

The warning panel is intended to show what accounting should review before using the summary outside WMS.

## Accounting Handoff Boundary

The accounting handoff note explains that the report is a preview. Accounting remains responsible for formal accounting documents and downstream processing.

Future Phase 7 work should be Accounting Charge Summary Plugin Foundation. Bplus is the first accounting / ERP handoff target. Infor ERP M3 is the future accounting / ERP handoff target. The plugin should send monthly storage charge summary / accounting review summary only.

The plugin must not sync inventory, pull inventory from ERP, send WMS stock movement as ERP inventory movement, overwrite WMS stock, overwrite ERP stock, overwrite master data automatically, generate invoices, or post accounting entries. Accounting users must review summaries before billing in the accounting / ERP system.

## Exclusions

Invoice generation is not included because TGD WMS is not the accounting document generator.

Billing engine behavior is not included because rate cards, charge rules, approval workflow, and customer billing policies require a separate approved scope.

Period lock behavior is not included because this sprint does not create billing periods or persisted billing batches.

Accounting posting is not included because this report does not write accounting entries.

Export file generation is not included because this sprint only creates report screens and preview row shaping.

## Next Sprint Recommendation

Recommended next sprint: Phase 7 Accounting Charge Summary Plugin Foundation for reviewed monthly storage charge summary handoff.
