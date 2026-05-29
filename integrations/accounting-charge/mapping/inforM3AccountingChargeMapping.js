/*
  Infor ERP M3 Accounting Charge Mapping Placeholder
  -------------------------------------------------
  This module provides pure functions to create a draft mapping from the
  canonical monthly storage charge summary to generic Infor M3 placeholder
  fields. It contains no runtime side‑effects, network calls, or persistence.
*/

// --------------------------------------------------------------------------
// Exported field definitions
// --------------------------------------------------------------------------
export const INFOR_M3_ACCOUNTING_CHARGE_TARGET_FIELDS = [
  'm3_customer_code',
  'm3_customer_name',
  'm3_billing_period',
  'm3_service_code',
  'm3_service_description',
  'm3_quantity',
  "m3_weight",
  'm3_unit',
  'm3_accounting_note',
  'm3_validation_status',
];

export const INFOR_M3_ACCOUNTING_CHARGE_REQUIRED_FIELDS = [
  'm3_customer_code',
  'm3_billing_period',
  'm3_service_code',
  'm3_quantity',
  'm3_weight',
];

export const INFOR_M3_ACCOUNTING_CHARGE_OPTIONAL_FIELDS = [
  'm3_customer_name',
  'm3_service_description',
  'm3_unit',
  'm3_accounting_note',
];

// --------------------------------------------------------------------------
// Draft creation helpers – pure functions only
// --------------------------------------------------------------------------
/**
 * Create an empty mapping draft – an array that will hold the mapped rows.
 * The function is pure and returns a new array each call.
 */
export function createInforM3AccountingChargeMappingDraft() {
  return [];
}

/**
 * Map a canonical row object to an Infor M3 draft row.
 * @param {object} row - Canonical charge summary row.
 * @param {object} [options] - Optional mapping overrides (currently unused).
 * @returns {object} Mapped draft row with placeholder fields.
 */
export function mapCanonicalRowToInforM3Draft(row, options = {}) {
  // Defensive copy – ensure purity.
  const draft = {
    m3_customer_code: row.customer_code ?? '',
    m3_customer_name: row.customer_name ?? '',
    m3_billing_period: row.billing_period ?? '',
    m3_service_code: row.service_code ?? '',
    m3_service_description: row.service_description ?? '',
    m3_quantity: row.quantity ?? 0,
    m3_weight: row.weight ?? 0,
    m3_unit: row.unit ?? '',
    m3_accounting_note: row.accounting_note ?? '',
    m3_validation_status: 'PENDING',
  };
  // Apply any option overrides (shallow merge).
  return { ...draft, ...options };
}

/**
 * Map a canonical summary object to an Infor M3 draft summary.
 * The summary shape mirrors the row mapping but aggregates totals.
 */
export function mapCanonicalSummaryToInforM3Draft(summary, options = {}) {
  const draft = {
    m3_customer_code: summary.customer_code ?? '',
    m3_customer_name: summary.customer_name ?? '',
    m3_billing_period: summary.billing_period ?? '',
    m3_service_code: summary.service_code ?? '',
    m3_service_description: summary.service_description ?? '',
    m3_quantity: summary.total_quantity ?? 0,
    m3_weight: summary.total_weight ?? 0,
    m3_unit: summary.unit ?? '',
    m3_accounting_note: summary.note ?? '',
    m3_validation_status: 'PENDING',
  };
  return { ...draft, ...options };
}

/**
 * Validate a mapping draft – ensure each row contains all required fields.
 * Returns an array of error messages; empty array means the draft is valid.
 */
export function validateInforM3MappingDraft(mappedRows) {
  if (!Array.isArray(mappedRows)) {
    return ['Mapping draft must be an array of rows'];
  }
  const errors = [];
  mappedRows.forEach((row, idx) => {
    INFOR_M3_ACCOUNTING_CHARGE_REQUIRED_FIELDS.forEach((field) => {
      if (!row[field] && row[field] !== 0) {
        errors.push(`Row ${idx + 1}: missing required field ${field}`);
      }
    });
  });
  return errors;
}

/**
 * Provide a high‑level description of this mapping placeholder.
 */
export function describeInforM3AccountingChargeMapping() {
  return {
    targetSystem: 'Infor ERP M3',
    purpose: 'Future draft mapping for monthly storage charge summary handoff.',
    placeholderOnly: true,
    targetFields: INFOR_M3_ACCOUNTING_CHARGE_TARGET_FIELDS,
    requiredFields: INFOR_M3_ACCOUNTING_CHARGE_REQUIRED_FIELDS,
    optionalFields: INFOR_M3_ACCOUNTING_CHARGE_OPTIONAL_FIELDS,
  };
}
