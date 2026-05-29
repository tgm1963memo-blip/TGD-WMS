# Sprint 7C: Accounting Charge Summary Staging Preview

This document outlines the architecture, design, and validation details of the **Sprint 7C: Accounting Charge Summary Staging Preview** implementation.

## Sprint Purpose

Sprint 7C provides the user interface staging preview area where accounting operators can review monthly storage charge summaries in both a canonical format and a target Bplus draft format. This preview step allows operators to inspect and validate all rows, check for warnings and errors, and assess readiness before future integration pipelines are activated.

## Staging Preview Concept

The staging area functions as a read-only, in-memory review console. It provides:
1. **Canonical Schema Verification:** A standardized view of monthly storage billing charges calculated by WMS.
2. **Bplus Draft Mapping Preview:** A preview of how these canonical rows map into the Bplus-specific draft schema format.
3. **Readiness and Warning Diagnostics:** Automatic classifiers flagging missing customer codes, missing service codes, or zero quantity/weight records.
4. **Temporary Operators Work Notes:** A localized text area for review notes that operates entirely in memory.

---

## Source Data & Integrations

The staging service retrieves its data purely from the read-only service:
- `monthlyStorageBillingSummaryService.js` (which combines `storageWeightSnapshotService.js` and `operationChargeLogService.js` previews).

No direct database connections or mutations occur. All mapping, translation, and validation checks are executed offline in-memory.

---

## Data Schemas

### Canonical Payload Preview
Standard WMS monthly storage charge fields:
- `billing_period` (e.g. `2026-05`)
- `customer_code` / `customer_name`
- `warehouse_code`
- `deposit_qty` (Inbound quantity)
- `withdrawal_qty` (Outbound quantity)
- `remaining_qty` (Inventory on-hand)
- `chargeable_qty` (Total calculated amount previewed)
- `chargeable_weight` (Calculated chargeable weight)
- `validation_status` (Staging validation review state)
- `accounting_note` (Operational text comments)

### Bplus Draft Mapping Preview
Target draft fields mapped using Bplus mapping rules:
- `bplus_customer_code`
- `bplus_customer_name`
- `bplus_billing_period`
- `bplus_service_code` (e.g., `STORAGE`)
- `bplus_service_description`
- `bplus_quantity`
- `bplus_weight`
- `bplus_unit`
- `bplus_accounting_note`
- `bplus_validation_status`

---

## Validation & Readiness Statuses

The Bplus validator automatically classifies the overall staging state:
- `READY_FOR_ACCOUNTING_REVIEW` - All rows are complete and ready.
- `MISSING_CUSTOMER_CODE` - One or more rows do not have customer codes.
- `MISSING_BILLING_PERIOD` - One or more rows are missing the billing period.
- `MISSING_SERVICE_CODE` - One or more rows do not have the pre-defined service code.
- `MISSING_QUANTITY_OR_WEIGHT` - One or more rows contain zero/negative quantity and weight.
- `REQUIRES_REVIEW` - One or more rows have validation status set to `NEEDS_REVIEW` or `INVALID`.

---

## Strict Read-Only Boundary & Safety Enforcements

In accordance with integration safety reviews:
- **No file exports:** Absolutely no generation of CSV, Excel, PDF, JSON, or TXT draft files.
- **No external integrations:** Zero network calls, third-party requests, or direct Bplus live database connectors.
- **No invoice creation:** No functions exist to generate legal invoice structures.
- **No accounting posts:** No ledger entries can be posted.
- **No periods lock:** No locking of billing periods can occur.
- **No inventory sync:** Inventory balances remain unaffected. Stock movements and adjustments are excluded from this flow.
- **Wording Constraint:** Control labels are strictly preview-oriented. Active wording (such as send, export, generate, finalize, lock, or post) is completely absent.

---

## Next Sprint Recommendations

- **Sprint 7D (Future):** Introduce secured and authenticated manual review logs to the database, maintaining separation of concerns while persisting operator comments.
- **Sprint 7E (Future):** Formulate offline batch file staging definitions for eventual manual download, still isolating the WMS from direct network handoffs.
