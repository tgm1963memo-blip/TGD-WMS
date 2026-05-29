# Sprint 7B Bplus Accounting Charge Summary Mapping Foundation

## Purpose
Sprint 7B implements the Bplus-specific mapping logic, canonical translation schemas, warning validation layers, and handoff mapping readiness rules. The services map reviewed Monthly Storage Billing Summary data into a structured Bplus draft format in-memory, without live connections or database writes.

## Bplus First Target
Bplus is the primary target for monthly storage and handling charge handoff. The canonical cold storage summary data is shaped specifically to accommodate Bplus's expected master structures (e.g. customer codes, monthly billing periods, operation quantities, and weights) while remaining easily adaptable for future targets such as Infor ERP M3.

## Mapping Draft Concept
The mapping represents a preview-only mapping draft. No automatic execution or active ERP data mutation is performed. The mapped Bplus schema translates canonical monthly storage summary attributes into generic placeholder fields ready for accounting user review.

## Canonical-to-Bplus Mapping
The mapping service translates canonical entries into standard Bplus-compliant draft entries:
- `customer_code` -> `bplus_customer_code`
- `customer_name` -> `bplus_customer_name`
- `billing_period` -> `bplus_billing_period`
- Options mapping support -> `bplus_service_code` (e.g. `STORAGE` or `STORAGE_SUMMARY`)
- Options mapping support -> `bplus_service_description`
- `chargeable_qty` -> `bplus_quantity`
- `chargeable_weight` -> `bplus_weight`
- Canonical / Options fallback -> `bplus_unit` (e.g. `KG`)
- `accounting_note` -> `bplus_accounting_note`
- `validation_status` -> `bplus_validation_status`

## Validation/Readiness Logic
The `bplusAccountingChargeValidator` provides robust in-memory checking:
- **`validateBplusAccountingChargeRow`**: Checks mandatory Bplus constraints.
- **`validateBplusAccountingChargePayload`**: Audits headers and all child rows.
- **`collectBplusMappingWarnings`**: Highlights warnings such as zero quantities/weights or empty accounting notes.
- **`classifyBplusMappingReadiness`**: Identifies mapping readiness states, including:
  - `READY_FOR_ACCOUNTING_REVIEW`
  - `MISSING_CUSTOMER_CODE`
  - `MISSING_BILLING_PERIOD`
  - `MISSING_SERVICE_CODE`
  - `MISSING_QUANTITY_OR_WEIGHT`
  - `REQUIRES_REVIEW`

## Strict No Live Connector
Sprint 7B is strictly offline:
- Zero endpoint declarations, API keys, secrets, or passwords exist.
- Zero network client libraries or fetch helpers are imported.
- Absolutely no live data handoff occurs.

## Strict No Inventory Sync
TGD WMS operates strictly as a cold storage deposit and withdrawal system.
- Zero inventory synchronizations exist.
- Zero stock import or export routines exist.
- Zero stock movement records are exported as ERP inventory transactions.
- Zero automatic WMS/ERP stock or master data overrides are supported.

## Strict No Invoice Generation
Invoice creation and billing period closing logic reside exclusively within Bplus/ERP systems. Sprints in the WMS do not implement invoice engines or billing generation.

## Strict No Accounting Post
TGD WMS does not prepare, compile, or post active general ledger accounting entries.

## Next Sprint Recommendation
Sprint 7C should construct a read-only Monthly Storage Charge Billing Summary Preview UI dashboard page incorporating these mapping drafts and validation readiness indicators, continuing to operate strictly on mock data and select-only models.
