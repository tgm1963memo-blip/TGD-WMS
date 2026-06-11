import { OPERATION_CHARGE_TYPES } from '../constants/coldStorageBilling.js';
import { getUnifiedMovementRows } from './unifiedMovementReadService.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getOperationChargeLogs(filters = {}) {
  const result = await getUnifiedMovementRows({
    ...filters,
    excludeDraft: true,
  });

  if (result.error) {
    return { data: null, error: result.error };
  }

  const rows = (result.data ?? []).map((row) => ({
    ...row,
    operation_type: row.movement_subtype ?? row.movement_type_canonical ?? row.movement_type,
    warehouse_id: row.to_warehouse_id ?? row.from_warehouse_id ?? null,
    charge_qty: row.qty,
  }));

  if (filters.chargeType) {
    return {
      data: rows.filter((row) => row.operation_type === filters.chargeType),
      error: null,
    };
  }

  return { data: rows, error: null };
}

export async function getOperationChargeSummary(filters = {}) {
  const { data, error } = await getOperationChargeLogs(filters);

  if (error) return { data: null, error };

  return {
    data: calculateOperationChargePreview(data ?? [], filters.rateOptions ?? {}),
    error: null,
  };
}

export function getOperationChargeTypes() {
  return Object.values(OPERATION_CHARGE_TYPES);
}

export function calculateOperationChargePreview(rows = [], rateOptions = {}) {
  return rows.map((row) => {
    const chargeType = row.operation_type ?? row.movement_subtype ?? OPERATION_CHARGE_TYPES.OTHER;
    const rate = Number(rateOptions[chargeType] ?? rateOptions.defaultRate ?? 0);
    const quantity = Number(row.charge_qty ?? row.qty ?? 0);

    return {
      ...row,
      charge_type: chargeType,
      charge_qty: quantity,
      rate,
      preview_amount: quantity * rate,
    };
  });
}
