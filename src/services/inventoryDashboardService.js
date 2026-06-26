import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyStockFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.customerId) {
    nextQuery = nextQuery.eq('customer_id', filters.customerId);
  }

  if (filters.warehouseId) {
    nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  }

  if (filters.productId) {
    nextQuery = nextQuery.eq('product_id', filters.productId);
  }

  if (filters.locationId) {
    nextQuery = nextQuery.eq('location_id', filters.locationId);
  }

  return nextQuery;
}

function summarizeStockRows(rows = []) {
  const productIds = new Set();
  const lotIds = new Set();
  const palletIds = new Set();

  const totals = rows.reduce((summary, row) => {
    if (row.product_id) productIds.add(row.product_id);
    if (row.lot_id) lotIds.add(row.lot_id);
    if (row.pallet_id) palletIds.add(row.pallet_id);

    return {
      totalStockQty: summary.totalStockQty + Number(row.qty_on_hand ?? 0),
      totalAllocatedQty: summary.totalAllocatedQty + Number(row.qty_allocated ?? 0),
      availableQty: summary.availableQty + Math.max(0, Number(row.qty_on_hand ?? 0) - Number(row.qty_allocated ?? 0)),
    };
  }, {
    totalStockQty: 0,
    totalAllocatedQty: 0,
    availableQty: 0,
  });

  return {
    ...totals,
    skuCount: productIds.size,
    lotCount: lotIds.size,
    palletCount: palletIds.size,
  };
}

function groupStockRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      qty_on_hand: 0,
      qty_allocated: 0,
      qty_available: 0,
      sku_count: 0,
      productIds: new Set(),
    };

    current.qty_on_hand += Number(row.qty_on_hand ?? 0);
    current.qty_allocated += Number(row.qty_allocated ?? 0);
    current.qty_available += Math.max(0, Number(row.qty_on_hand ?? 0) - Number(row.qty_allocated ?? 0));
    if (row.product_id) current.productIds.add(row.product_id);
    current.sku_count = current.productIds.size;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values()).map(({ productIds, ...group }) => group);
}

function formatDateOnly(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function getStockBalanceRows(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const query = applyStockFilters(
    supabase
      .from('tgd_stock_balances')
      .select('id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_allocated')
      .order('qty_on_hand', { ascending: true }),
    filters,
  );

  return query;
}

export async function getInventorySummary(filters = {}) {
  const { data, error } = await getStockBalanceRows(filters);

  if (error) {
    return { data: null, error };
  }

  return { data: summarizeStockRows(data ?? []), error: null };
}

export async function getLowStockItems(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const threshold = Number(filters.threshold ?? 0);
  const { data, error } = await applyStockFilters(
    supabase
      .from('tgd_stock_balances')
      .select('id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_allocated')
      .order('qty_on_hand', { ascending: true }),
    filters,
  );

  if (error) return { data: null, error };

  const filtered = (data ?? []).filter((row) => {
    const available = Number(row.qty_on_hand ?? 0) - Number(row.qty_allocated ?? 0);
    return available <= threshold;
  });

  return { data: filtered, error: null };
}

export async function getExpiringLots(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const daysAhead = Number(filters.daysAhead ?? 30);
  const expiresBefore = new Date();
  expiresBefore.setDate(expiresBefore.getDate() + daysAhead);

  return supabase
    .from('tgd_lots')
    .select('id, product_id, lot_no, exp_date, received_date, is_active')
    .eq('is_active', true)
    .lte('exp_date', formatDateOnly(expiresBefore))
    .order('exp_date', { ascending: true });
}

export async function getInventoryByWarehouse(filters = {}) {
  const { data, error } = await getStockBalanceRows(filters);

  if (error) {
    return { data: null, error };
  }

  return { data: groupStockRows(data ?? [], 'warehouse_id'), error: null };
}

export async function getInventoryByCustomer(filters = {}) {
  const { data, error } = await getStockBalanceRows(filters);

  if (error) {
    return { data: null, error };
  }

  return { data: groupStockRows(data ?? [], 'customer_id'), error: null };
}
