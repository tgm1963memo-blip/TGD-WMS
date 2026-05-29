# SOP: Reports And Accounting Review

## Inventory Dashboard

1. Open Inventory Dashboard.
2. Review total stock, available quantity, allocated quantity, SKUs, lots, and pallets.
3. Use dashboard as operational visibility only.

## Movement Ledger Report

1. Open Movement Ledger Report.
2. Filter by date, customer, product, warehouse, or reference.
3. Review customer stock movement history.
4. Use ledger for audit trail and operational investigation.

## Customer Storage Balance Report

1. Open Customer Storage Balance Report.
2. Verify stock by customer, product, lot, pallet, warehouse, room, and location.
3. Use report to support customer stock confirmation and storage billing preparation.

## Storage Aging Report

1. Open Storage Aging Report.
2. Review aging buckets, expiry status, chargeable day preview, and long-aging stock.
3. Escalate expired or near-expiry stock according to warehouse policy.

## Warehouse Operation Performance Report

1. Open Warehouse Operation Performance Report.
2. Review operation counts by type, status, customer, and warehouse.
3. Review operation charge activity preview where data exists.

## Monthly Storage Billing Summary

1. Open Monthly Storage Billing Summary.
2. Select billing month/year, customer, or warehouse filters.
3. Review deposit/inbound quantity, withdrawal/outbound quantity, remaining quantity, chargeable quantity/weight preview, operation charge activity, and validation warnings.
4. Record rows missing rate, weight, or required review.

## Accounting Charge Staging Preview

1. Open Accounting Charge Staging Preview.
2. Review canonical charge rows and validation status.
3. Confirm rows are review-only.
4. Record missing data or customer/reference issues.

## Accounting Charge Handoff Review Draft

1. Open Accounting Charge Handoff Review Draft.
2. Review handoff payload preview.
3. Confirm accounting users must review before billing in the accounting system.
4. Record approval or required corrections outside system posting.

## Review-Only Behavior

- Reports and accounting review pages are for visibility and preparation.
- They must not update stock.
- They must not create invoice generation.
- They must not perform accounting post.
- They must not trigger ERP inventory sync.

## Handoff To Accounting Process Assumption

TGD WMS prepares review data for accounting. Accounting reviews the summary, resolves validation warnings, and performs final billing outside WMS according to accounting procedure.

## Control Points

- Reports must be used as read-only operational and accounting review evidence.
- Monthly Storage Billing Summary must be reviewed before any accounting handoff.
- Accounting Charge Review rows with missing data must be corrected or documented before handoff.
- Movement ledger and stock balance evidence should support customer billing review questions.

## Evidence / Record-keeping

- Keep report filter criteria, report date/time, and reviewer name.
- Capture screenshot or evidence of dashboard, movement ledger, storage balance, aging, operation performance, and billing summary views used for review.
- Record movement ledger reference and stock balance evidence when reviewing stock movement or customer balance.
- Record accounting reviewer name, timestamp, validation warnings, and handoff review notes where applicable.
- Link report evidence to UAT scenario, defect, or accounting review reference.
