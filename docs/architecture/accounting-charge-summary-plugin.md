# Accounting Charge Summary Plugin

## Purpose

The Accounting Charge Summary Plugin is an architecture foundation for handing off reviewed monthly storage charge summary data from TGD WMS to an accounting / ERP system.

TGD WMS remains a cold storage deposit, storage, and customer withdrawal system. The plugin is for accounting charge summary handoff only. It is not inventory sync and is not an accounting posting engine.

## Targets

Bplus is the first accounting / ERP handoff target.

Infor ERP M3 is a future accounting / ERP handoff target for the same type of monthly storage charge summary / accounting review summary.

## Data Included In Handoff

The handoff may include reviewed summary fields such as:

- billing period
- customer
- deposit / inbound quantity or weight summary
- withdrawal / outbound quantity or weight summary
- remaining quantity or weight summary
- chargeable quantity / weight preview
- operation charge activity summary
- validation status
- accounting note

## Data Excluded From Handoff

The handoff must exclude:

- inventory sync
- stock balance as ERP inventory
- stock movement transactions
- location movement
- pallet movement
- picking allocation
- inventory adjustment posting

The plugin must not pull inventory from ERP, send WMS stock movement as ERP inventory movement, overwrite WMS stock, overwrite ERP stock, or overwrite master data automatically.

## Adapter / Interface Concept

The plugin should use an adapter interface so Bplus and future Infor ERP M3 handoff formats can share the same validated summary payload shape.

Each adapter should map only reviewed accounting charge summary data. No adapter should read or write operational stock state as an ERP inventory transaction.

## Staging And Validation Requirement

Summary rows should pass staging and validation before any accounting / ERP handoff. Validation should check customer identity, billing period, chargeable quantity or weight, operation charge activity, validation status, and accounting notes.

Rows with missing customer, missing rate, missing weight, or inconsistent charge data should remain in review status.

## Review-Before-Billing Rule

Accounting users must review summaries before billing in the accounting / ERP system. The WMS handoff should support review, validation, and traceability, not automatic billing.

## No Invoice Generation Rule

TGD WMS must not generate invoices from this plugin. Invoice creation remains in the accounting / ERP system unless a later approved scope changes that boundary.

## No Accounting Post Rule

TGD WMS must not post accounting entries from this plugin. The plugin prepares accounting charge summary handoff data only.
