export const BPLUS_ACCOUNTING_CHARGE_TARGET_FIELDS = Object.freeze([
  'bplus_customer_code',
  'bplus_customer_name',
  'bplus_billing_period',
  'bplus_service_code',
  'bplus_service_description',
  'bplus_quantity',
  'bplus_weight',
  'bplus_unit',
  'bplus_accounting_note',
  'bplus_validation_status',
]);

export const BPLUS_ACCOUNTING_CHARGE_REQUIRED_FIELDS = Object.freeze([
  'bplus_customer_code',
  'bplus_billing_period',
  'bplus_service_code',
]);

export const BPLUS_ACCOUNTING_CHARGE_OPTIONAL_FIELDS = Object.freeze([
  'bplus_customer_name',
  'bplus_service_description',
  'bplus_quantity',
  'bplus_weight',
  'bplus_unit',
  'bplus_accounting_note',
  'bplus_validation_status',
]);

export function createBplusAccountingChargeMappingDraft() {
  return {
    bplus_customer_code: '',
    bplus_customer_name: '',
    bplus_billing_period: '',
    bplus_service_code: '',
    bplus_service_description: '',
    bplus_quantity: 0,
    bplus_weight: 0,
    bplus_unit: '',
    bplus_accounting_note: '',
    bplus_validation_status: '',
  };
}

export function mapCanonicalRowToBplusDraft(row = {}, options = {}) {
  return {
    bplus_customer_code: row.customer_code ?? '',
    bplus_customer_name: row.customer_name ?? '',
    bplus_billing_period: row.billing_period ?? '',
    bplus_service_code: options.serviceCode ?? 'STORAGE',
    bplus_service_description: options.serviceDescription ?? 'Cold storage fee',
    bplus_quantity: Number(row.chargeable_qty ?? 0),
    bplus_weight: Number(row.chargeable_weight ?? 0),
    bplus_unit: row.uom ?? options.unit ?? 'KG',
    bplus_accounting_note: row.accounting_note ?? '',
    bplus_validation_status: row.validation_status ?? 'DRAFT',
  };
}

export function mapCanonicalSummaryToBplusDraft(summary = {}, options = {}) {
  return {
    bplus_customer_code: summary.customer_code ?? '',
    bplus_customer_name: summary.customer_name ?? '',
    bplus_billing_period: summary.billing_period ?? '',
    bplus_service_code: options.serviceCode ?? 'STORAGE_SUMMARY',
    bplus_service_description: options.serviceDescription ?? 'Monthly cold storage summary charge',
    bplus_quantity: Number(summary.chargeable_qty ?? 0),
    bplus_weight: Number(summary.chargeable_weight ?? 0),
    bplus_unit: options.unit ?? 'KG',
    bplus_accounting_note: summary.accounting_note ?? '',
    bplus_validation_status: summary.validation_status ?? 'DRAFT',
  };
}

export function validateBplusMappingDraft(mappedRows = []) {
  const errors = [];

  mappedRows.forEach((row, index) => {
    BPLUS_ACCOUNTING_CHARGE_REQUIRED_FIELDS.forEach((field) => {
      if (!row[field]) {
        errors.push(`Row ${index}: ${field} is required.`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function describeBplusAccountingChargeMapping() {
  return 'Bplus Accounting Charge Summary Mapping maps canonical cold storage summaries to Bplus-specific draft schema format.';
}
