export function validateAccountingChargePayload(payload = {}) {
  const errors = [];

  if (!validateBillingPeriod(payload.billing_period).valid) {
    errors.push('Billing period is required.');
  }

  if (!Array.isArray(payload.rows)) {
    errors.push('Rows must be an array.');
  }

  const rowResults = Array.isArray(payload.rows)
    ? payload.rows.map(validateAccountingChargeRow)
    : [];

  rowResults.forEach((result, index) => {
    if (!result.valid) {
      errors.push({ index, errors: result.errors });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    rowResults,
  };
}

export function validateAccountingChargeRow(row = {}) {
  const errors = [];

  if (!validateCustomerReference(row.customer_code ?? row.customer_id).valid) {
    errors.push('Customer reference is required.');
  }

  if (!row.validation_status) {
    errors.push('Validation status is required.');
  }

  const amountResult = validateChargeSummaryAmounts(row);
  if (!amountResult.valid) {
    errors.push(...amountResult.errors);
  }

  if (row.operation_charge_summary !== undefined && typeof row.operation_charge_summary !== 'object') {
    errors.push('Operation charge summary must be structured.');
  }

  if (row.accounting_note !== undefined && typeof row.accounting_note !== 'string') {
    errors.push('Accounting note must be text.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateBillingPeriod(value) {
  return {
    valid: typeof value === 'string' && /^\d{4}-\d{2}$/.test(value),
  };
}

export function validateCustomerReference(value) {
  return {
    valid: typeof value === 'string' && value.trim().length > 0,
  };
}

export function validateChargeSummaryAmounts(row = {}) {
  const errors = [];
  const hasChargeableQty = row.chargeable_qty !== undefined && row.chargeable_qty !== null;
  const hasChargeableWeight = row.chargeable_weight !== undefined && row.chargeable_weight !== null;

  if (!hasChargeableQty && !hasChargeableWeight) {
    errors.push('Chargeable quantity or weight is required for review.');
  }

  ['deposit_qty', 'withdrawal_qty', 'remaining_qty', 'chargeable_qty', 'chargeable_weight'].forEach((field) => {
    if (row[field] !== undefined && Number(row[field]) < 0) {
      errors.push(`${field} cannot be negative.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function collectAccountingChargeValidationWarnings(payload = {}) {
  const validation = validateAccountingChargePayload(payload);

  if (validation.valid) {
    return [];
  }

  return validation.errors;
}
