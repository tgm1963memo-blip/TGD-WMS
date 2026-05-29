import { OPERATION_CHARGE_TYPES } from '../constants/coldStorageBilling.js';
import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyChargeFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.customerId) nextQuery = nextQuery.eq('customer_id', filters.customerId);
  if (filters.warehouseId) nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  if (filters.productId) nextQuery = nextQuery.eq('product_id', filters.productId);
  if (filters.chargeType) nextQuery = nextQuery.eq('operation_type', filters.chargeType);
  if (filters.dateFrom) nextQuery = nextQuery.gte('created_at', filters.dateFrom);
  if (filters.dateTo) nextQuery = nextQuery.lte('created_at', filters.dateTo);

  return nextQuery;
}

export async function getOperationChargeLogs(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  return applyChargeFilters(
    supabase
      .from('tgd_inventory_movements')
      .select('id, customer_id, product_id, lot_id, from_warehouse_id, to_warehouse_id, qty, uom, movement_type, movement_subtype, reference_type, reference_no, remark, created_at')
      .order('created_at', { ascending: false }),
    filters,
  );
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
