# Sprint 6C-Prep Billing Services Foundation

## Purpose

Sprint 6C-Prep adds service-layer foundations for cold storage billing support. The services prepare preview-only read models and pure calculations for accounting review without creating a billing engine or changing stock.

TGD WMS remains a cold storage deposit, storage, and customer withdrawal system. Customers own the stored inventory. Billing support is based on storage weight, remaining balance, storage period, and warehouse operation charges.

## Services

### Storage Weight Snapshot Service

`storageWeightSnapshotService.js` prepares daily and monthly storage weight previews from stock balance data. It can calculate chargeable weight and group preview rows by customer, warehouse, or product.

The service does not persist snapshots.

### Operation Charge Log Service

`operationChargeLogService.js` prepares preview rows for warehouse service charges such as lifting, repack, sorting, labeling, palletizing, freezing service, and other handling work.

The service returns charge examples and calculates preview amounts only.

### Monthly Storage Billing Summary Service

`monthlyStorageBillingSummaryService.js` combines storage weight previews and operation charge previews for accounting review. It validates preview rows before any future billing workflow is designed.

This service does not finalize billing.

### Rate Card Service

`rateCardService.js` prepares a read-only rate card foundation. It returns customer records as preview rate card anchors and supplies default storage and operation rate rules for future planning.

It does not create or change rate cards.

### Billing Export Service

`billingExportService.js` maps preview rows into accounting handoff shapes and validates them. It lists supported preview formats only.

It does not write files, create export batches, or send data to accounting systems.

### Customer Storage Balance Report Service

`customerStorageBalanceReportService.js` prepares read-only customer storage balance summaries by customer, product, warehouse, and lot. It supports Sprint 6C reporting work without stock changes.

## Strict preview-only Scope

Sprint 6C-Prep does not include:

- no invoice generation
- no billing engine
- no accounting posting
- no period lock
- no database schema change
- no export file generation
- no stock updates
- no inventory movement posting
- no Express sync

## Relationship To Sprint 6C

Sprint 6C Customer Storage Balance Report should use the customer storage balance service as a read-only foundation for balance reporting by customer, product, warehouse, and lot.

## Relationship To Sprint 6F

Sprint 6F Monthly Storage Billing Summary Foundation can build on these preview services to design billing summary screens, rate review, and accounting handoff preparation. Sprint 6F should still keep final accounting ownership outside WMS unless a later approved scope adds it.
