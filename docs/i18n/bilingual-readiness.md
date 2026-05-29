# Bilingual Readiness Documentation

- **TGD WMS supports Thai (default) and English (secondary).**
- Thai (`th`) is the default language; English (`en`) is the secondary supported language.
- Translation keys follow a consistent naming convention using snake_case, e.g., `accounting_charge_handoff_review`.
- All UI text, route labels, and permission area descriptions should be retrieved via `getTranslation(key, language)` from `src/i18n/translationCatalog.js`.
- Future UI components must reference these keys rather than hard‑coded Thai strings.
- Route and report labels that must be bilingual include:
  - `accounting_charge_handoff_review`
  - `accounting_charge_staging_preview`
  - `inventory_dashboard`
  - `monthly_storage_billing_summary`
  - `movement_ledger`
  - `customer_storage_balance`
  - `storage_aging`
  - `warehouse_operation_performance`
- **Warning:** Any new UI text should use the translation keys where practical to maintain bilingual consistency.
