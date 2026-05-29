# Accounting Charge Summary Plugin Foundation

## Purpose

This integration area defines a neutral plugin interface for accounting charge summary handoff. It is for monthly storage charge summary / accounting review summary data only.

TGD WMS remains the warehouse operation system for cold storage deposit, storage, and customer withdrawal. The plugin does not handle inventory state in any ERP.

## Targets

Bplus is the first accounting / ERP handoff target.

Infor ERP M3 is a future accounting / ERP handoff target.

## Sprint 7B: Bplus Mapping Foundation

Sprint 7B implements the Bplus-specific schema mapping draft and validator rules:
- Sourced from reviewed Monthly Storage Billing Summary canonical entries.
- Maps to standard Bplus draft fields (`bplus_customer_code`, `bplus_service_code`, `bplus_billing_period`, `bplus_quantity`, `bplus_weight`, etc.).
- Bplus validation rules classify payload readiness (`READY_FOR_ACCOUNTING_REVIEW`, `MISSING_CUSTOMER_CODE`, `MISSING_BILLING_PERIOD`, etc.).
- The Bplus mapping is **draft-only** and completely in-memory.

## Strict Boundary

This foundation does not include:
- **No live connector**: No endpoints, apiKeys, or credentials exist.
- **No external API calls**: No network libraries are used.
- **No file writes/exports**: No physical CSV/Excel generation occurs.
- **No inventory synchronization**: No stock import, stock export, or stock movement exports occur as ERP inventory transactions.
- **No invoice generation**: Invoice creation remains strictly inside the ERP.
- **No accounting posting**: No general ledger entries are written.
- **No automatic overrides**: No stock or master data is overwritten automatically.

Accounting users must review monthly storage charge summaries before billing in the accounting / ERP system.

## Adapter Approach

Adapters implement the neutral accounting charge plugin contract. Sprints 7A and 7B build the pure interface and placeholder adaptions. No live integrations occur in this layer.
## Sprint 7E – Infor ERP M3 Future Mapping Placeholder

- **Purpose**: Draft‑only mapping for future Infor ERP M3 handoff.
- **Boundary**: No live connector, no endpoint, no credentials, no API calls, no file export, no inventory sync, no invoice generation, no accounting posting.
- **Adapter**: Placeholder adapter with exports `INFOR_M3_ADAPTER_NAME`, `createInforM3AdapterPlaceholder`, `describeInforM3AccountingChargeMapping`, `getInforM3SupportedHandoffModes`, `validateInforM3AdapterConfiguration`.
- **Mapping**: Pure functions in `mapping/inforM3AccountingChargeMapping.js`.
- **Validator**: Pure functions in `validation/inforM3AccountingChargeValidator.js`.
