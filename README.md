# TGD WMS

TGD WMS is a new build cold storage warehouse management system for goods deposit, storage, customer withdrawal, dispatch / goods issue, and customer-owned inventory control.

TGD operates a cold storage service business. Customers deposit goods into storage, TGD manages those goods, and customers later request withdrawal. TGD does not sell the goods stored in this system.

This is not a sales-order WMS and not a sales invoicing system. Accounting support should be provided through monthly storage billing summaries and exports, not full accounting logic inside WMS.

This repository is a fresh start. The old system is reference only and must not be refactored, imported, or copied wholesale into the new build. In particular, do not copy large blocks from legacy `App.jsx`.

## New Build Rules

- Old system files are reference only.
- No wholesale copy from legacy `App.jsx`.
- New application code belongs under `src/`.
- Inventory must be movement-ledger-driven.
- Stock balance must not be changed directly.
- Customer isolation is mandatory.
- Stock is customer-owned inventory.
- Audit log is mandatory.
- Barcode handheld support is required.
- Billing support is based on weight, balance, storage period, and operation charges such as repack, sorting, labeling, lifting, and other warehouse services.

## Current Sprint Boundary

This sprint only creates the project boundary and documentation structure.

Do not implement React UI yet.
Do not create database migrations yet.
Do not implement Express sync yet.

## Sprint 0B Setup

Sprint 0B adds the React + Vite application foundation for TGD WMS. It includes routing, layout components, placeholder feature pages, a safe Supabase client shell, and basic render testing.

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build and test:

```bash
npm run build
npm test
```

Business logic, database migrations, Express sync, and legacy code imports remain intentionally out of scope.

Accounting integration should be a billing summary/export handoff. TGD WMS should not generate accounting invoices or run a billing engine until a later approved scope introduces that capability.

## Accounting Charge Summary Handoff

Phase 7 is scoped as Accounting Charge Summary Plugin Foundation. Bplus is the first accounting / ERP handoff target. Infor ERP M3 is a future accounting / ERP handoff target.

The plugin sends monthly storage charge summary / accounting review summary only. It does not sync inventory, does not pull inventory from ERP, does not send WMS stock movement as ERP inventory movement, does not overwrite WMS stock, does not overwrite ERP stock, and does not overwrite master data automatically. It does not generate invoices or post accounting entries. Accounting users must review summaries before billing in the accounting / ERP system.

## OneDrive Notes

This project is inside OneDrive. To reduce sync and file lock issues:

- Avoid syncing `node_modules` if possible.
- Do not manually edit files while Codex is running.
- Watch for file lock issues when tools, editors, or OneDrive sync operate at the same time.
