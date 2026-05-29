# Sprint 7A Accounting Charge Plugin Interface

## Sprint Purpose

Sprint 7A creates a neutral accounting charge summary plugin interface for monthly storage charge summary handoff. The foundation supports Bplus first and Infor ERP M3 later through placeholder adapters.

## Interface Foundation

`accountingChargePluginInterface.js` defines plugin capabilities, handoff statuses, payload creation, payload normalization, and plugin contract validation.

All functions are pure and in-memory.

## Canonical Schema

`accountingChargeCanonicalSchema.js` defines canonical accounting charge summary fields:

- billing period
- customer code
- customer name
- warehouse code
- deposit quantity
- withdrawal quantity
- remaining quantity
- chargeable quantity
- chargeable weight
- operation charge summary
- validation status
- accounting note

It also lists operational inventory fields that must be excluded from accounting charge handoff.

## Validation Layer

`accountingChargePayloadValidator.js` validates billing period, customer reference, chargeable quantity or weight, operation charge summary structure, accounting note, and validation status.

Validation is pure and does not write data.

## Adapter Registry

`accountingChargeAdapterRegistry.js` provides an in-memory adapter registry. It does not persist adapters and does not create production connectors.

## Bplus Placeholder

`bplusAdapter.placeholder.js` describes the future Bplus accounting charge summary mapping. It is a placeholder only and does not connect to Bplus.

## Infor ERP M3 Placeholder

`inforM3Adapter.placeholder.js` describes the future Infor ERP M3 accounting charge summary mapping. It is a placeholder only and does not connect to Infor ERP M3.

## Strict Scope

Sprint 7A does not include:

- inventory synchronization
- stock import
- stock export
- stock movement handoff as ERP inventory activity
- invoice generation
- accounting posting
- live connector behavior
- database schema changes
- policy changes
- legacy changes

## Next Sprint Recommendation

Sprint 7B should define a Bplus accounting charge summary mapping draft using validated canonical payloads, without live connectivity.
