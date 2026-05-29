# Inventory Principles

Inventory in TGD WMS must be movement-ledger-driven.

Stock balance must not be changed directly. Every inventory change must originate from a recorded movement such as goods deposit / receiving, putaway, transfer, adjustment, picking, dispatch / goods issue, stock count, or baseline import.

Stock is customer-owned inventory. TGD stores and handles goods for customers; TGD does not sell those goods.

Stock balances are derived from validated movement records and must preserve customer isolation, lot traceability, pallet traceability, and location traceability.

Every inventory movement must be auditable.

Outbound operations must use Customer Withdrawal Request terminology. Billing support must be based on weight, balance, storage period, and operation charges such as repack, sorting, labeling, lifting, and other warehouse services.

Accounting integration should be a Monthly Storage Billing Summary or export handoff. Full accounting invoice generation is outside the WMS inventory principle boundary.
