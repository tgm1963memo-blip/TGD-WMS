import { getCustomerBillingSummaryPreview } from './monthlyStorageBillingSummaryService.js';
import { createCanonicalAccountingChargeRow } from '../../integrations/accounting-charge/mapping/accountingChargeCanonicalSchema.js';
import { mapCanonicalRowToBplusDraft } from '../../integrations/accounting-charge/mapping/bplusAccountingChargeMapping.js';
import {
  validateBplusAccountingChargePayload,
  collectBplusMappingWarnings,
  classifyBplusMappingReadiness
} from '../../integrations/accounting-charge/validation/bplusAccountingChargeValidator.js';

export function buildCanonicalChargePayloadFromBillingSummary(summaryRows = [], options = {}) {
  const period = options.billingPeriod || options.billing_period || '';
  const system = options.targetSystem || options.target_system || 'Bplus';
  
  const rows = summaryRows.map(row => {
    return createCanonicalAccountingChargeRow({
      billing_period: period,
      customer_code: row.customer_id ?? '',
      customer_name: row.customer_name ?? `Customer ${row.customer_id}`,
      warehouse_code: row.warehouse_code ?? row.warehouse_id ?? 'WH-COLD',
      deposit_qty: row.deposit_qty ?? 0,
      withdrawal_qty: row.withdrawal_qty ?? 0,
      remaining_qty: row.remaining_qty ?? 0,
      chargeable_qty: row.chargeable_qty ?? row.total_preview_amount ?? 0,
      chargeable_weight: row.chargeable_weight ?? 0,
      operation_charge_summary: {
        storage_charge: row.storage_charge_preview ?? 0,
        operation_charge: row.operation_charge_preview ?? 0,
      },
      validation_status: row.validation_status ?? 'DRAFT',
      accounting_note: row.accounting_note ?? 'Staging preview only. Read-only review.'
    });
  });

  return {
    billing_period: period,
    target_system: system,
    rows
  };
}

export function buildBplusDraftPayloadPreview(canonicalPayload = {}, options = {}) {
  const rows = Array.isArray(canonicalPayload.rows) ? canonicalPayload.rows : [];
  const mappedRows = rows.map(row => mapCanonicalRowToBplusDraft(row, options));
  
  return {
    billing_period: canonicalPayload.billing_period ?? '',
    target_system: 'Bplus',
    rows: mappedRows
  };
}

export function validateAccountingChargeStagingPayload(payload = {}, options = {}) {
  const validation = validateBplusAccountingChargePayload(payload);
  const warnings = collectBplusMappingWarnings(payload);
  
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings,
  };
}

export function summarizeAccountingChargeStagingRows(rows = []) {
  const total = rows.length;
  let ready = 0;
  let warnings = 0;
  let missingCustomerCode = 0;
  let missingBillingPeriod = 0;
  let missingServiceCode = 0;
  let missingQtyWeight = 0;
  let requiresReview = 0;

  rows.forEach(row => {
    const hasMissingCustomer = !row.bplus_customer_code;
    const hasMissingPeriod = !row.bplus_billing_period;
    const hasMissingService = !row.bplus_service_code;
    const hasMissingQtyWeight = Number(row.bplus_quantity ?? 0) <= 0 && Number(row.bplus_weight ?? 0) <= 0;
    const hasRequiresReview = row.bplus_validation_status === 'NEEDS_REVIEW' || row.bplus_validation_status === 'INVALID';

    if (hasMissingCustomer) missingCustomerCode++;
    if (hasMissingPeriod) missingBillingPeriod++;
    if (hasMissingService) missingServiceCode++;
    if (hasMissingQtyWeight) missingQtyWeight++;
    if (hasRequiresReview) requiresReview++;

    const hasWarnings = hasMissingQtyWeight || !row.bplus_accounting_note;
    if (hasWarnings) warnings++;

    const isReady = !hasMissingCustomer && !hasMissingPeriod && !hasMissingService && !hasMissingQtyWeight && !hasRequiresReview;
    if (isReady) ready++;
  });

  return {
    total_staging_rows: total,
    ready_rows: ready,
    warning_rows: warnings,
    missing_customer_code_rows: missingCustomerCode,
    missing_billing_period_rows: missingBillingPeriod,
    missing_service_code_rows: missingServiceCode,
    missing_quantity_weight_rows: missingQtyWeight,
    requires_review_rows: requiresReview,
  };
}

export function groupAccountingChargeWarnings(warnings = []) {
  const grouped = {};
  warnings.forEach(w => {
    const match = w.match(/^Row (\d+): (.*)/);
    if (match) {
      const rowIndex = match[1];
      const message = match[2];
      if (!grouped[rowIndex]) grouped[rowIndex] = [];
      grouped[rowIndex].push(message);
    } else {
      if (!grouped['general']) grouped['general'] = [];
      grouped['general'].push(w);
    }
  });
  return grouped;
}

export function classifyStagingReadiness(payload = {}) {
  return classifyBplusMappingReadiness(payload);
}

export async function getAccountingChargeStagingPreview(filters = {}) {
  const year = filters.year ?? '2026';
  const month = String(filters.month ?? '05').padStart(2, '0');
  const billingPeriod = filters.billing_period || filters.billingPeriod || `${year}-${month}`;
  
  const summaryRes = await getCustomerBillingSummaryPreview(filters);
  if (summaryRes.error) {
    return { data: null, error: summaryRes.error };
  }

  const summaryRows = summaryRes.data || [];
  const options = {
    billingPeriod,
    targetSystem: 'Bplus',
    serviceCode: 'STORAGE',
    serviceDescription: 'Cold storage fee',
    unit: 'KG'
  };

  const canonicalPayload = buildCanonicalChargePayloadFromBillingSummary(summaryRows, options);
  const bplusDraftPayload = buildBplusDraftPayloadPreview(canonicalPayload, options);
  const validation = validateAccountingChargeStagingPayload(bplusDraftPayload, options);
  const summary = summarizeAccountingChargeStagingRows(bplusDraftPayload.rows);
  const groupedWarnings = groupAccountingChargeWarnings(validation.warnings);
  const readiness = classifyStagingReadiness(bplusDraftPayload);

  return {
    data: {
      billing_period: billingPeriod,
      target_system: 'Bplus',
      readiness_status: readiness,
      summary,
      canonical_payload: canonicalPayload,
      bplus_draft_payload: bplusDraftPayload,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      grouped_warnings: groupedWarnings,
      accounting_note: 'Preview only. Strictly no-send boundary enforced.'
    },
    error: null
  };
}
