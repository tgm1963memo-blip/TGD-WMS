import { getOperationChargeLogs } from './operationChargeLogService.js';
import { getMonthlyStorageWeightPreview } from './storageWeightSnapshotService.js';

function groupCombinedRows(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const customerId = row.customer_id ?? 'UNASSIGNED';
    const current = groups.get(customerId) ?? {
      id: customerId,
      customer_id: customerId,
      storage_charge_preview: 0,
      operation_charge_preview: 0,
      chargeable_weight: 0,
      row_count: 0,
    };

    current.storage_charge_preview += Number(row.storage_charge_preview ?? 0);
    current.operation_charge_preview += Number(row.operation_charge_preview ?? row.preview_amount ?? 0);
    current.chargeable_weight += Number(row.chargeable_weight ?? 0);
    current.row_count += 1;
    groups.set(customerId, current);
  });

  return Array.from(groups.values()).map((row) => ({
    ...row,
    total_preview_amount: row.storage_charge_preview + row.operation_charge_preview,
  }));
}

export async function getMonthlyStorageBillingPreview(filters = {}) {
  const [storageResult, operationResult] = await Promise.all([
    getMonthlyStorageWeightPreview(filters),
    getOperationChargeLogs(filters),
  ]);

  if (storageResult.error) return { data: null, error: storageResult.error };
  if (operationResult.error) return { data: null, error: operationResult.error };

  return {
    data: combineStorageAndOperationCharges(storageResult.data ?? [], operationResult.data ?? [], filters),
    error: null,
  };
}

export async function getCustomerBillingSummaryPreview(filters = {}) {
  const { data, error } = await getMonthlyStorageBillingPreview(filters);

  if (error) return { data: null, error };

  return { data: groupCombinedRows(data ?? []), error: null };
}

export function combineStorageAndOperationCharges(storageRows = [], operationRows = [], options = {}) {
  const storageRate = Number(options.storageRate ?? 0);
  const storagePreviewRows = storageRows.map((row) => ({
    ...row,
    preview_source: 'STORAGE_WEIGHT',
    storage_charge_preview: Number(row.chargeable_weight ?? 0) * storageRate,
  }));

  const operationPreviewRows = operationRows.map((row) => ({
    ...row,
    preview_source: 'OPERATION_CHARGE',
    operation_charge_preview: Number(row.preview_amount ?? 0),
  }));

  return [...storagePreviewRows, ...operationPreviewRows];
}

export function validateBillingPreviewRows(rows = []) {
  const errors = [];

  rows.forEach((row, index) => {
    if (!row.customer_id) errors.push({ index, field: 'customer_id', message: 'Customer is required for preview review.' });
    if (Number(row.chargeable_weight ?? 0) < 0) errors.push({ index, field: 'chargeable_weight', message: 'Chargeable weight cannot be negative.' });
    if (Number(row.preview_amount ?? row.storage_charge_preview ?? row.operation_charge_preview ?? 0) < 0) {
      errors.push({ index, field: 'preview_amount', message: 'Preview amount cannot be negative.' });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function summarizeBillingPreviewRows(rows = []) {
  const customerIds = new Set();

  return rows.reduce((summary, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);

    summary.total_customers = customerIds.size;
    summary.total_deposit_qty += Number(row.deposit_qty ?? row.inbound_qty ?? 0);
    summary.total_withdrawal_qty += Number(row.withdrawal_qty ?? row.outbound_qty ?? 0);
    summary.total_remaining_qty += Number(row.remaining_qty ?? row.qty_boxes ?? row.qty_on_hand ?? row.qty_available ?? 0);
    summary.estimated_chargeable_weight_qty += Number(row.chargeable_weight ?? row.chargeable_qty ?? 0);
    summary.operation_charge_activity_count += row.preview_source === 'OPERATION_CHARGE' ? 1 : 0;

    const validationStatus = classifyBillingValidationStatus(row);
    if (validationStatus === 'MISSING_RATE') summary.rows_missing_rate += 1;
    if (validationStatus === 'MISSING_WEIGHT') summary.rows_missing_weight += 1;
    if (validationStatus !== 'READY_FOR_REVIEW') summary.rows_requiring_accounting_review += 1;

    return summary;
  }, {
    total_customers: 0,
    total_deposit_qty: 0,
    total_withdrawal_qty: 0,
    total_remaining_qty: 0,
    estimated_chargeable_weight_qty: 0,
    operation_charge_activity_count: 0,
    rows_missing_rate: 0,
    rows_missing_weight: 0,
    rows_requiring_accounting_review: 0,
  });
}

export function classifyBillingValidationStatus(row = {}) {
  const rate = Number(row.storage_rate ?? row.rate ?? 0);
  const weight = Number(row.chargeable_weight ?? row.chargeable_qty ?? row.qty_on_hand ?? 0);

  if (!row.customer_id) return 'MISSING_CUSTOMER';
  if (rate <= 0 && row.preview_source === 'STORAGE_WEIGHT') return 'MISSING_RATE';
  if (weight <= 0 && row.preview_source === 'STORAGE_WEIGHT') return 'MISSING_WEIGHT';

  return 'READY_FOR_REVIEW';
}
