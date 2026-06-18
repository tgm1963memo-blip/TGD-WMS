import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyStorageAgingFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.customerId) nextQuery = nextQuery.eq('customer_id', filters.customerId);
  if (filters.productId) nextQuery = nextQuery.eq('product_id', filters.productId);
  if (filters.warehouseId) nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  if (filters.locationId) nextQuery = nextQuery.eq('location_id', filters.locationId);
  if (filters.lotId) nextQuery = nextQuery.eq('lot_id', filters.lotId);
  if (filters.palletId) nextQuery = nextQuery.eq('pallet_id', filters.palletId);

  return nextQuery;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay));
}

function enrichAgingRows(rows = [], filters = {}) {
  const today = parseDate(filters.dateAsOf) ?? new Date();

  return rows.map((row) => {
    const storageStartDate = row.storage_start_date ?? row.received_date ?? row.created_at;
    const agingDays = daysBetween(parseDate(storageStartDate), today);
    const expiryStatus = classifyExpiryStatus(row.expiry_date ?? row.exp_date, today);
    const agingBucket = classifyAgingBucket(agingDays);
    const chargeableDays = Number(filters.freeDays ?? 0) > 0
      ? Math.max(0, agingDays - Number(filters.freeDays ?? 0))
      : agingDays;

    return {
      ...row,
      storage_start_date: storageStartDate,
      aging_days: agingDays,
      aging_bucket: agingBucket,
      expiry_status: expiryStatus,
      chargeable_days: chargeableDays,
    };
  }).filter((row) => {
    if (filters.agingBucket && row.aging_bucket !== filters.agingBucket) return false;
    if (filters.expiryStatus && row.expiry_status !== filters.expiryStatus) return false;
    if (filters.chargeableOnly && Number(row.chargeable_days ?? 0) <= 0) return false;

    if (filters.search) {
      const searchText = String(filters.search).toLowerCase();
      const searchable = [
        row.customer_id,
        row.product_id,
        row.lot_id,
        row.pallet_id,
        row.warehouse_id,
        row.location_id,
      ].join(' ').toLowerCase();

      return searchable.includes(searchText);
    }

    return true;
  });
}

function summarizeAgingRows(rows = []) {
  const customerIds = new Set();
  const lotIds = new Set();
  const palletIds = new Set();

  return rows.reduce((summary, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);
    if (row.lot_id) lotIds.add(row.lot_id);
    if (row.pallet_id) palletIds.add(row.pallet_id);

    summary.total_customers = customerIds.size;
    summary.total_lots = lotIds.size;
    summary.total_pallets = palletIds.size;
    summary.total_stock_qty += Number(row.qty_on_hand ?? 0);
    summary.estimated_chargeable_days += Number(row.chargeable_days ?? 0);

    if (row.aging_bucket === '0_30') summary.aging_0_30 += 1;
    if (row.aging_bucket === '31_60') summary.aging_31_60 += 1;
    if (row.aging_bucket === '61_90') summary.aging_61_90 += 1;
    if (row.aging_bucket === 'OVER_90') summary.aging_over_90 += 1;
    if (row.expiry_status === 'NEAR_EXPIRY') summary.near_expiry_lots += 1;
    if (row.expiry_status === 'EXPIRED') summary.expired_lots += 1;

    return summary;
  }, {
    total_customers: 0,
    total_lots: 0,
    total_pallets: 0,
    total_stock_qty: 0,
    aging_0_30: 0,
    aging_31_60: 0,
    aging_61_90: 0,
    aging_over_90: 0,
    near_expiry_lots: 0,
    expired_lots: 0,
    estimated_chargeable_days: 0,
  });
}

function groupAgingRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      row_count: 0,
      qty_on_hand: 0,
      aging_days_total: 0,
      chargeable_days_total: 0,
      near_expiry_lots: 0,
      expired_lots: 0,
    };

    current.row_count += 1;
    current.qty_on_hand += Number(row.qty_on_hand ?? 0);
    current.aging_days_total += Number(row.aging_days ?? 0);
    current.chargeable_days_total += Number(row.chargeable_days ?? 0);
    if (row.expiry_status === 'NEAR_EXPIRY') current.near_expiry_lots += 1;
    if (row.expiry_status === 'EXPIRED') current.expired_lots += 1;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values()).map((row) => ({
    ...row,
    average_aging_days: row.row_count ? Math.round(row.aging_days_total / row.row_count) : 0,
  }));
}

export async function getStorageAgingRows(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const query = applyStorageAgingFilters(
    supabase
      .from('tgd_stock_balances')
      .select('id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_allocated, uom, created_at')
      .order('created_at', { ascending: true }),
    filters,
  );

  const { data, error } = await query;
  if (error) return { data: null, error };

  return { data: enrichAgingRows(data ?? [], filters), error: null };
}

export async function getStorageAgingSummary(filters = {}) {
  const { data, error } = await getStorageAgingRows(filters);
  if (error) return { data: null, error };

  return { data: summarizeAgingRows(data ?? []), error: null };
}

export async function getExpiryAlertRows(filters = {}) {
  const { data, error } = await getStorageAgingRows(filters);
  if (error) return { data: null, error };

  return {
    data: (data ?? []).filter((row) => ['NEAR_EXPIRY', 'EXPIRED'].includes(row.expiry_status)),
    error: null,
  };
}

export async function getChargeableDaysPreview(filters = {}) {
  const { data, error } = await getStorageAgingRows({ ...filters, chargeableOnly: true });
  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((row) => ({
      ...row,
      chargeable_days_preview: Number(row.chargeable_days ?? 0),
    })),
    error: null,
  };
}

export function groupAgingByCustomer(rows = []) {
  return groupAgingRows(rows, 'customer_id');
}

export function groupAgingByWarehouse(rows = []) {
  return groupAgingRows(rows, 'warehouse_id');
}

export function groupAgingByProduct(rows = []) {
  return groupAgingRows(rows, 'product_id');
}

export function classifyAgingBucket(days) {
  const safeDays = Number(days ?? 0);
  if (safeDays <= 30) return '0_30';
  if (safeDays <= 60) return '31_60';
  if (safeDays <= 90) return '61_90';
  return 'OVER_90';
}

export function classifyExpiryStatus(expiryDate, today = new Date()) {
  const expiry = parseDate(expiryDate);
  const asOfDate = parseDate(today) ?? new Date();

  if (!expiry) return 'NO_EXPIRY_DATE';
  if (expiry < asOfDate) return 'EXPIRED';

  const daysToExpiry = daysBetween(asOfDate, expiry);
  if (daysToExpiry <= 30) return 'NEAR_EXPIRY';

  return 'OK';
}
