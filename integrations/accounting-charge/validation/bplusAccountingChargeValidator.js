export function validateBplusAccountingChargeRow(row = {}) {
  const errors = [];

  if (!row.bplus_customer_code) errors.push('bplus_customer_code is required.');
  if (!row.bplus_billing_period) errors.push('bplus_billing_period is required.');
  if (!row.bplus_service_code) errors.push('bplus_service_code is required.');

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateBplusAccountingChargePayload(payload = {}) {
  const errors = [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!payload.billing_period) errors.push('billing_period is required in payload header.');
  if (payload.target_system !== 'Bplus') errors.push('target_system must be Bplus.');

  rows.forEach((row, index) => {
    const rowValidation = validateBplusAccountingChargeRow(row);
    rowValidation.errors.forEach((err) => {
      errors.push(`Row ${index}: ${err}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function collectBplusMappingWarnings(payload = {}) {
  const warnings = [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  rows.forEach((row, index) => {
    if (Number(row.bplus_quantity ?? 0) <= 0 && Number(row.bplus_weight ?? 0) <= 0) {
      warnings.push(`Row ${index}: Quantity and weight are both zero or negative.`);
    }
    if (!row.bplus_accounting_note) {
      warnings.push(`Row ${index}: bplus_accounting_note is empty.`);
    }
  });

  return warnings;
}

export function classifyBplusMappingReadiness(payload = {}) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!payload.billing_period) {
    return 'MISSING_BILLING_PERIOD';
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.bplus_customer_code) return 'MISSING_CUSTOMER_CODE';
    if (!row.bplus_billing_period) return 'MISSING_BILLING_PERIOD';
    if (!row.bplus_service_code) return 'MISSING_SERVICE_CODE';
    if (Number(row.bplus_quantity ?? 0) <= 0 && Number(row.bplus_weight ?? 0) <= 0) {
      return 'MISSING_QUANTITY_OR_WEIGHT';
    }
    if (row.bplus_validation_status === 'NEEDS_REVIEW' || row.bplus_validation_status === 'INVALID') {
      return 'REQUIRES_REVIEW';
    }
  }

  return 'READY_FOR_ACCOUNTING_REVIEW';
}
