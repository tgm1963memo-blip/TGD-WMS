# System Overview

TGD WMS is a new build cold storage warehouse management system with a clean boundary from the legacy system.

The business model is goods deposit, storage, movement, stock count, customer withdrawal, and dispatch / goods issue for customer-owned inventory. TGD does not sell the stored goods.

The system will be organized around:

- Movement-ledger inventory transactions
- Derived stock balances
- Mandatory customer isolation
- Customer-owned inventory controls
- Mandatory audit logging
- Barcode handheld workflows
- Customer Stock Movement reporting
- Monthly Storage Billing Summary support
- Read-only integration boundaries for external sync sources

This is not a sales-order WMS and not a sales invoicing system. Accounting integration should receive billing summaries or exports for storage fees and operation charges, while full accounting invoice generation remains outside WMS scope.

## ERP / Accounting Plugin Boundary

Phase 7 is Accounting Charge Summary Plugin Foundation. Bplus is the first accounting / ERP handoff target. Infor ERP M3 is the future accounting / ERP handoff target.

The plugin is for monthly storage charge summary / accounting review summary handoff only. It does not sync inventory, does not pull inventory from ERP, and does not send WMS stock movement as ERP inventory movement. It must not overwrite WMS stock, ERP stock, or master data automatically.

The plugin does not generate invoices and does not post accounting entries. Accounting users must review summaries before billing in the accounting / ERP system.

No React UI, database migration, or Express sync implementation exists in this sprint.
