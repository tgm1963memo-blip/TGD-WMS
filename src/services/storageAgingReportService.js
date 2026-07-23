import { getAllCustomerStockBalances } from './customerDepositRequestService.js';
import { getCustomers } from './masterDataService.js';
import { toLiveStockBalanceRows } from '../utils/liveStockBalanceRows.js';

function applyStorageAgingFilters(rows, filters = {}) {
  return rows.filter((row) => {
    if (filters.customerId && row.customer_id !== filters.customerId) return false;
    if (filters.productId) {
      const q = String(filters.productId).toLowerCase();
      const hay = `${row.product_code ?? ''} ${row.product_name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.lotNo && !(row.lot_no ?? '').toLowerCase().includes(String(filters.lotNo).toLowerCase())) return false;
    return true;
  });
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

/** Like daysBetween but allows negative values (for expired items) */
function signedDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

export function enrichAgingRows(rows = [], filters = {}) {
  const today = parseDate(filters.dateAsOf) ?? new Date();

  return rows.map((row) => {
    const storageStartDate = row.storage_start_date ?? row.received_date ?? row.received_at;
    const agingDays = daysBetween(parseDate(storageStartDate), today);
    const expiryStatus = classifyExpiryStatus(row.expiry_date ?? row.exp_date, today);
    const agingBucket = classifyAgingBucket(agingDays);
    const chargeableDays = Number(filters.freeDays ?? 0) > 0
      ? Math.max(0, agingDays - Number(filters.freeDays ?? 0))
      : agingDays;

    const expiryDateObj = parseDate(row.expiry_date ?? row.exp_date);
    const remainingShelfLifeDays = expiryDateObj ? signedDaysBetween(today, expiryDateObj) : null;

    return {
      ...row,
      storage_start_date: storageStartDate,
      aging_days: agingDays,
      aging_bucket: agingBucket,
      expiry_status: expiryStatus,
      chargeable_days: chargeableDays,
      remaining_shelf_life_days: remainingShelfLifeDays,
    };
  }).filter((row) => {
    if (filters.agingBucket && row.aging_bucket !== filters.agingBucket) return false;
    if (filters.expiryStatus && row.expiry_status !== filters.expiryStatus) return false;
    if (filters.chargeableOnly && Number(row.chargeable_days ?? 0) <= 0) return false;

    if (filters.search) {
      const searchText = String(filters.search).toLowerCase();
      const searchable = [
        row.customer_name,
        row.product_code,
        row.product_name,
        row.lot_no,
        row.tracking_code,
      ].join(' ').toLowerCase();

      return searchable.includes(searchText);
    }

    return true;
  });
}

export function summarizeAgingRows(rows = []) {
  const customerIds = new Set();
  const lotNos = new Set();

  const summary = rows.reduce((acc, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);
    if (row.lot_no) lotNos.add(row.lot_no);

    acc.total_customers = customerIds.size;
    acc.total_lots = lotNos.size;
    acc.total_stock_qty += Number(row.qty_boxes ?? 0);
    acc.estimated_chargeable_days += Number(row.chargeable_days ?? 0);

    if (row.aging_bucket === '0_30') acc.aging_0_30 += 1;
    if (row.aging_bucket === '31_60') acc.aging_31_60 += 1;
    if (row.aging_bucket === '61_90') acc.aging_61_90 += 1;
    if (row.aging_bucket === 'OVER_90') acc.aging_over_90 += 1;
    if (row.expiry_status === 'NEAR_EXPIRY') acc.near_expiry_lots += 1;
    if (row.expiry_status === 'EXPIRED') acc.expired_lots += 1;
    if (row.expiry_status === 'NO_EXPIRY_DATE') acc.no_expiry_lots += 1;

    acc.total_aging_days += Number(row.aging_days ?? 0);
    if (row.remaining_shelf_life_days !== null && row.remaining_shelf_life_days !== undefined) {
      acc.total_remaining_shelf_life_days += Number(row.remaining_shelf_life_days);
      acc.lots_with_expiry += 1;
    }

    return acc;
  }, {
    total_customers: 0,
    total_lots: 0,
    total_stock_qty: 0,
    aging_0_30: 0,
    aging_31_60: 0,
    aging_61_90: 0,
    aging_over_90: 0,
    near_expiry_lots: 0,
    expired_lots: 0,
    estimated_chargeable_days: 0,
    no_expiry_lots: 0,
    total_aging_days: 0,
    total_remaining_shelf_life_days: 0,
    lots_with_expiry: 0,
  });

  summary.average_storage_age = rows.length ? Math.round(summary.total_aging_days / rows.length) : 0;
  summary.average_shelf_life = summary.lots_with_expiry ? Math.round(summary.total_remaining_shelf_life_days / summary.lots_with_expiry) : 0;

  return summary;
}

function groupAgingRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      row_count: 0,
      qty_boxes: 0,
      aging_days_total: 0,
      chargeable_days_total: 0,
      near_expiry_lots: 0,
      expired_lots: 0,
    };

    current.row_count += 1;
    current.qty_boxes += Number(row.qty_boxes ?? 0);
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

// Reads the same live, freshly-computed balance the "ยอดคงเหลือ" pages use
// (see liveStockBalanceRows.js) instead of the separately-maintained
// per-location stock ledger table + a lot-master join + deposit-line expiry
// fallback this used to read, which could disagree with ยอดคงเหลือ for the same
// product/customer and used the ledger's own row-insert time as
// "storage_start_date" rather than the deposit's actual receipt date. The
// RPC's own exp_date/received_at cover both needs directly — no separate
// tgd_lots/location lookups needed. Trade-off: no location/warehouse/pallet
// data (deposit lines aren't tied to one in this schema).
export async function getStorageAgingRows(filters = {}) {
  const [balanceResult, customersResult] = await Promise.all([
    getAllCustomerStockBalances(),
    getCustomers(),
  ]);

  if (balanceResult.error) return { data: null, error: balanceResult.error };
  if (customersResult.error) return { data: null, error: customersResult.error };

  const rows = toLiveStockBalanceRows(balanceResult.data ?? [], customersResult.data ?? []);
  const filtered = applyStorageAgingFilters(rows, filters);

  return { data: enrichAgingRows(filtered, filters), error: null };
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
  return groupAgingRows(rows, 'customer_name');
}

export function groupAgingByProduct(rows = []) {
  return groupAgingRows(rows, 'product_code');
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

  return 'GOOD';
}
