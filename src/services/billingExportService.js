import { SUPPORTED_BILLING_EXPORT_FORMATS } from '../constants/coldStorageBilling.js';
import { getMonthlyStorageBillingPreview } from './monthlyStorageBillingSummaryService.js';

export async function getBillingExportPreview(filters = {}) {
  const { data, error } = await getMonthlyStorageBillingPreview(filters);

  if (error) return { data: null, error };

  return {
    data: mapBillingSummaryToExportRows(data ?? [], filters),
    error: null,
  };
}

export function mapBillingSummaryToExportRows(summaryRows = [], options = {}) {
  return summaryRows.map((row, index) => ({
    row_no: index + 1,
    customer_id: row.customer_id,
    warehouse_id: row.warehouse_id,
    product_id: row.product_id,
    lot_id: row.lot_id,
    chargeable_weight: Number(row.chargeable_weight ?? 0),
    storage_charge_preview: Number(row.storage_charge_preview ?? 0),
    operation_charge_preview: Number(row.operation_charge_preview ?? row.preview_amount ?? 0),
    total_preview_amount: Number(row.storage_charge_preview ?? 0)
      + Number(row.operation_charge_preview ?? row.preview_amount ?? 0),
    currency: options.currency ?? row.currency ?? 'THB',
    preview_source: row.preview_source ?? 'BILLING_SUPPORT',
  }));
}

export function validateExportRows(rows = []) {
  const errors = [];

  rows.forEach((row, index) => {
    if (!row.customer_id) errors.push({ index, field: 'customer_id', message: 'Customer is required.' });
    if (Number(row.total_preview_amount ?? 0) < 0) errors.push({ index, field: 'total_preview_amount', message: 'Amount cannot be negative.' });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getSupportedExportFormats() {
  return Object.values(SUPPORTED_BILLING_EXPORT_FORMATS);
}
