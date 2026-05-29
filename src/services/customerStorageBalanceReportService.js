import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyBalanceFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.customerId) nextQuery = nextQuery.eq('customer_id', filters.customerId);
  if (filters.warehouseId) nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  if (filters.productId) nextQuery = nextQuery.eq('product_id', filters.productId);
  if (filters.lotId) nextQuery = nextQuery.eq('lot_id', filters.lotId);
  if (filters.locationId) nextQuery = nextQuery.eq('location_id', filters.locationId);
  if (filters.palletId) nextQuery = nextQuery.eq('pallet_id', filters.palletId);

  return nextQuery;
}

function summarizeBalanceRows(rows = []) {
  const customerIds = new Set();
  const productIds = new Set();
  const lotIds = new Set();
  const palletIds = new Set();

  const totals = rows.reduce((summary, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);
    if (row.product_id) productIds.add(row.product_id);
    if (row.lot_id) lotIds.add(row.lot_id);
    if (row.pallet_id) palletIds.add(row.pallet_id);

    summary.qty_on_hand += Number(row.qty_on_hand ?? 0);
    summary.qty_allocated += Number(row.qty_allocated ?? 0);
    summary.qty_available += Number(row.qty_available ?? 0);

    return summary;
  }, {
    qty_on_hand: 0,
    qty_allocated: 0,
    qty_available: 0,
  });

  return {
    ...totals,
    customer_count: customerIds.size,
    product_count: productIds.size,
    lot_count: lotIds.size,
    pallet_count: palletIds.size,
  };
}

function groupBalanceRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      qty_on_hand: 0,
      qty_allocated: 0,
      qty_available: 0,
      row_count: 0,
    };

    current.qty_on_hand += Number(row.qty_on_hand ?? 0);
    current.qty_allocated += Number(row.qty_allocated ?? 0);
    current.qty_available += Number(row.qty_available ?? 0);
    current.row_count += 1;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

export async function getCustomerStorageBalanceRows(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  return applyBalanceFilters(
    supabase
      .from('tgd_stock_balances')
      .select('id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_allocated, qty_available, uom, created_at')
      .order('created_at', { ascending: false }),
    filters,
  );
}

export async function getCustomerStorageBalanceSummary(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: summarizeBalanceRows(data ?? []), error: null };
}

export async function getStorageBalanceByCustomer(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'customer_id'), error: null };
}

export async function getStorageBalanceByProduct(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'product_id'), error: null };
}

export async function getStorageBalanceByWarehouse(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'warehouse_id'), error: null };
}

export async function getStorageBalanceByLot(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'lot_id'), error: null };
}
