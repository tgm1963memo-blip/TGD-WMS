# Cold Storage Billing Backlog

This backlog defines future modules for cold storage billing support. It is architecture planning only and does not create database schema, accounting logic, or invoice generation.

## Future Recommended Modules

### Customer Rate Cards

Rate cards should define customer-specific storage, handling, and operation charge rates.

### Storage Billing Periods

Billing periods should define monthly or custom billing windows for customer storage summaries.

### Daily / Monthly Storage Weight Snapshots

Snapshots should capture chargeable weight, balance, lot, pallet, and location state for billing evidence.

### Monthly Customer Storage Summaries

Monthly summaries should aggregate deposit, withdrawal, remaining balance, chargeable days, chargeable weight, and storage fees for accounting handoff.

### Operation Charge Logs

Operation charges should record lifting, repack, sorting, labeling, palletizing, inspection support, and other warehouse services.

### Billing Preview Report

Billing preview should let operations and accounting review chargeable storage and operation charge evidence before export.

### Billing Export Batch

Export batches should package approved billing summary data for accounting systems without turning WMS into the accounting system.

### Accounting Handoff

Accounting handoff should provide summary/export data. Accounting invoice generation remains outside WMS unless explicitly approved later.

Bplus is the first accounting / ERP handoff target for monthly storage charge summary / accounting review summary data. Infor ERP M3 is a future accounting / ERP handoff target for the same summary type.

The handoff must not sync inventory, pull inventory from ERP, send stock movement as ERP inventory movement, overwrite WMS stock, overwrite ERP stock, or overwrite master data automatically. Accounting users must review the summary before billing in the accounting / ERP system.

### Optional Scale Integration

Scale integration may capture inbound, outbound, and operation weights for billing support.

### Optional Temperature Log

Temperature logs may support cold storage compliance, customer reporting, or contractual evidence.

### Optional Customer Portal

A customer portal may expose read-only customer-owned inventory balances, movement history, and billing support summaries.

## Current Boundary

Sprint scope remains read-only reporting and operational foundation. No billing tables, invoice logic, accounting posting, or Express sync is implemented by this backlog.
