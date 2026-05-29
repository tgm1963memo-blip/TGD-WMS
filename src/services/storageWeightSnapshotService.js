import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyStorageFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.customerId) nextQuery = nextQuery.eq('customer_id', filters.customerId);
  if (filters.warehouseId) nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  if (filters.productId) nextQuery = nextQuery.eq('product_id', filters.productId);
  if (filters.lotId) nextQuery = nextQuery.eq('lot_id', filters.lotId);
  if (filters.locationId) nextQuery = nextQuery.eq('location_id', filters.locationId);
  if (filters.palletId) nextQuery = nextQuery.eq('pallet_id', filters.palletId);

  return nextQuery;
}

function groupByKey(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      qty_on_hand: 0,
      weight: 0,
      chargeable_weight: 0,
      row_count: 0,
    };

    current.qty_on_hand += Number(row.qty_on_hand ?? row.qty_available ?? 0);
    current.weight += Number(row.weight ?? row.gross_weight ?? row.net_weight ?? 0);
    current.chargeable_weight += Number(row.chargeable_weight ?? 0);
    current.row_count += 1;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

export async function getDailyStorageWeightPreview(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  return applyStorageFilters(
    supabase
      .from('tgd_stock_balances')
      .select('id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_available, uom, created_at')
      .order('created_at', { ascending: false }),
    filters,
  );
}

export async function getMonthlyStorageWeightPreview(filters = {}) {
  const { data, error } = await getDailyStorageWeightPreview(filters);

  if (error) return { data: null, error };

  return {
    data: calculateChargeableWeight(data ?? [], {
      minimumWeight: filters.minimumWeight,
      weightPerQty: filters.weightPerQty,
    }),
    error: null,
  };
}

export function calculateChargeableWeight(rows = [], options = {}) {
  const weightPerQty = Number(options.weightPerQty ?? 1);
  const minimumWeight = Number(options.minimumWeight ?? 0);

  return rows.map((row) => {
    const baseWeight = Number(row.weight ?? row.gross_weight ?? row.net_weight ?? 0);
    const qtyWeight = Number(row.qty_on_hand ?? row.qty_available ?? 0) * weightPerQty;
    const calculatedWeight = baseWeight > 0 ? baseWeight : qtyWeight;
    const chargeableWeight = Math.max(calculatedWeight, minimumWeight);

    return {
      ...row,
      calculated_weight: calculatedWeight,
      chargeable_weight: chargeableWeight,
    };
  });
}

export function groupStorageWeightByCustomer(rows = []) {
  return groupByKey(rows, 'customer_id');
}

export function groupStorageWeightByWarehouse(rows = []) {
  return groupByKey(rows, 'warehouse_id');
}

export function groupStorageWeightByProduct(rows = []) {
  return groupByKey(rows, 'product_id');
}
