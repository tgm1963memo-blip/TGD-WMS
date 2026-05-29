/*
  Infor ERP M3 Accounting Charge Validator (placeholder)
  -----------------------------------------------------
  Provides pure validation functions for the Infor M3 draft mapping.
  No side‑effects, network calls, or persistence.
*/

/**
 * Validate a single mapped row for required fields and basic data types.
 * Returns an array of warning strings; empty array means the row is valid.
 */
export function validateInforM3AccountingChargeRow(row) {
  const warnings = [];
  if (!row.m3_customer_code) {
    warnings.push('Missing m3_customer_code');
  }
  if (!row.m3_billing_period) {
    warnings.push('Missing m3_billing_period');
  }
  if (!row.m3_service_code) {
    warnings.push('Missing m3_service_code');
  }
  if (row.m3_quantity == null) {
    warnings.push('Missing m3_quantity');
  }
  if (row.m3_weight == null) {
    warnings.push('Missing m3_weight');
  }
  return warnings;
}

/**
 * Validate the full payload (array of rows) and produce a summary validation
 * object. Pure function – does not mutate input.
 */
export function validateInforM3AccountingChargePayload(payload) {
  if (!Array.isArray(payload)) {
    return { valid: false, errors: ['Payload must be an array'] };
  }
  const rowWarnings = payload.map(validateInforM3AccountingChargeRow);
  const hasWarnings = rowWarnings.some((w) => w.length > 0);
  return { valid: !hasWarnings, rowWarnings };
}

/**
 * Collect high‑level mapping warnings based on payload validation.
 */
export function collectInforM3MappingWarnings(payload) {
  const validation = validateInforM3AccountingChargePayload(payload);
  if (validation.valid) return [];
  const warnings = [];
  validation.rowWarnings.forEach((rowWarn, idx) => {
    if (rowWarn.length) {
      warnings.push(`Row ${idx + 1}: ${rowWarn.join(', ')}`);
    }
  });
  return warnings;
}

/**
 * Determine readiness status for the whole payload.
 * Possible statuses:
 *   - READY_FOR_ACCOUNTING_REVIEW
 *   - MISSING_CUSTOMER_CODE
 *   - MISSING_BILLING_PERIOD
 *   - MISSING_SERVICE_CODE
 *   - MISSING_QUANTITY_OR_WEIGHT
 *   - REQUIRES_REVIEW
 */
export function classifyInforM3MappingReadiness(payload) {
  const warnings = collectInforM3MappingWarnings(payload);
  if (!warnings.length) return 'READY_FOR_ACCOUNTING_REVIEW';
  // Simple heuristic – return first matching issue type.
  if (warnings.some((w) => w.includes('m3_customer_code')))
    return 'MISSING_CUSTOMER_CODE';
  if (warnings.some((w) => w.includes('m3_billing_period')))
    return 'MISSING_BILLING_PERIOD';
  if (warnings.some((w) => w.includes('m3_service_code')))
    return 'MISSING_SERVICE_CODE';
  if (warnings.some((w) => w.includes('m3_quantity') || w.includes('m3_weight')))
    return 'MISSING_QUANTITY_OR_WEIGHT';
  return 'REQUIRES_REVIEW';
}
