# Sprint 7E – Infor ERP M3 Future Mapping Placeholder

**Project**: TGD WMS
**Sprint**: 7E – Infor ERP M3 Future Mapping Placeholder
**Working Directory**: `C:/Users/TSS/OneDrive/เดสก์ท็อป/TGD Coldstorage/TGD WMS`

## Purpose
Create a **draft‑only** mapping layer for the future handoff of the monthly storage charge summary to Infor ERP M3. This code is a placeholder that mirrors the Bplus mapping structure but does **not** implement any live integration, network calls, or persistence.

## Future Target Concept
- The Infor M3 adapter is intended for a **future** release after the Bplus handoff is stable.
- No endpoint, credentials, or API configuration are provided at this stage.
- All logic runs **purely in‑memory** and is safe for staging environments.

## Canonical → Infor M3 Draft Mapping
- Mapping functions are defined in `integrations/accounting-charge/mapping/inforM3AccountingChargeMapping.js`.
- Required fields: `m3_customer_code`, `m3_billing_period`, `m3_service_code`, `m3_quantity`, `m3_weight`.
- Optional fields: `m3_customer_name`, `m3_service_description`, `m3_unit`, `m3_accounting_note`, `m3_validation_status`.
- Helper functions:
  - `createInforM3AccountingChargeMappingDraft()` – returns an empty array for draft rows.
  - `mapCanonicalRowToInforM3Draft(row, options)` – maps a canonical row to the draft schema.
  - `mapCanonicalSummaryToInforM3Draft(summary, options)` – maps a summary object.
  - `validateInforM3MappingDraft(mappedRows)` – validates required fields.
  - `describeInforM3AccountingChargeMapping()` – meta‑description of the placeholder mapping.

## Validator / Readiness Logic
Implemented in `integrations/accounting-charge/validation/inforM3AccountingChargeValidator.js`:
- `validateInforM3AccountingChargeRow(row)` – per‑row field checks.
- `validateInforM3AccountingChargePayload(payload)` – validates the entire payload.
- `collectInforM3MappingWarnings(payload)` – aggregates warnings.
- `classifyInforM3MappingReadiness(payload)` – returns one of:
  - `READY_FOR_ACCOUNTING_REVIEW`
  - `MISSING_CUSTOMER_CODE`
  - `MISSING_BILLING_PERIOD`
  - `MISSING_SERVICE_CODE`
  - `MISSING_QUANTITY_OR_WEIGHT`
  - `REQUIRES_REVIEW`

## Placeholder Adapter Boundary
File: `integrations/accounting-charge/adapters/inforM3Adapter.placeholder.js`
- Exports:
  - `INFOR_M3_ADAPTER_NAME`
  - `createInforM3AdapterPlaceholder`
  - `describeInforM3AccountingChargeMapping`
  - `getInforM3SupportedHandoffModes` – returns an empty array (no supported modes yet).
  - `validateInforM3AdapterConfiguration` – always returns `{ valid: true, errors: [] }`.
- **No live connector**, **no endpoint**, **no credentials**, **no API calls**, **no file export**, **no inventory sync**, **no invoice generation**, **no accounting posting**.

## Next Sprint Recommendation
**Phase 8 – Security / Permission / Production Hardening**
- Implement proper credential management for Infor M3.
- Add endpoint configuration and secure transport.
- Introduce validation against real‑world schema and permissions.
- Prepare migration scripts for eventual production handoff.
