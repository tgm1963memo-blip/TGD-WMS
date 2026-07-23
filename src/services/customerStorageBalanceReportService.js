import { getAllCustomerStockBalances } from './customerDepositRequestService.js';
import { getCustomers } from './masterDataService.js';
import { toLiveStockBalanceRows } from '../utils/liveStockBalanceRows.js';

// Reads the same live, freshly-computed balance the "ยอดคงเหลือ" pages use
// (see liveStockBalanceRows.js for why) instead of the separately-maintained
// per-location stock ledger table this report used to read, which could show a
// different number than "ยอดคงเหลือ" for the same product/customer.
function applyRowFilters(rows, filters = {}) {
  return rows.filter((row) => {
    if (filters.customerId && row.customer_id !== filters.customerId) return false;
    if (filters.temperatureType) {
      const wanted = Array.isArray(filters.temperatureType) ? filters.temperatureType : [filters.temperatureType];
      if (wanted.length && !wanted.includes(row.temperature_type ?? '-')) return false;
    }
    if (filters.productId) {
      const q = String(filters.productId).toLowerCase();
      const hay = `${row.product_code ?? ''} ${row.product_name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.lotNo) {
      if (!(row.lot_no ?? '').toLowerCase().includes(String(filters.lotNo).toLowerCase())) return false;
    }
    return true;
  });
}

function summarizeBalanceRows(rows = []) {
  const customerIds = new Set();
  const productCodes = new Set();
  const lotNos = new Set();

  const totals = rows.reduce((summary, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);
    if (row.product_code) productCodes.add(row.product_code);
    if (row.lot_no) lotNos.add(row.lot_no);

    summary.qty_boxes += row.qty_boxes;
    summary.qty_weight += row.qty_weight;

    return summary;
  }, { qty_boxes: 0, qty_weight: 0 });

  return {
    ...totals,
    customer_count: customerIds.size,
    product_count: productCodes.size,
    lot_count: lotNos.size,
  };
}

function groupBalanceRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      qty_boxes: 0,
      qty_weight: 0,
      row_count: 0,
    };

    current.qty_boxes += row.qty_boxes;
    current.qty_weight += row.qty_weight;
    current.row_count += 1;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

export async function getCustomerStorageBalanceRows(filters = {}) {
  const [balanceResult, customersResult] = await Promise.all([
    getAllCustomerStockBalances(),
    getCustomers(),
  ]);

  if (balanceResult.error) return { data: null, error: balanceResult.error };
  if (customersResult.error) return { data: null, error: customersResult.error };

  const rows = toLiveStockBalanceRows(balanceResult.data ?? [], customersResult.data ?? []);
  return { data: applyRowFilters(rows, filters), error: null };
}

export async function getCustomerStorageBalanceSummary(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: summarizeBalanceRows(data ?? []), error: null };
}

export async function getStorageBalanceByCustomer(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'customer_name'), error: null };
}

export async function getStorageBalanceByProduct(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'product_code'), error: null };
}

export async function getStorageBalanceByLot(filters = {}) {
  const { data, error } = await getCustomerStorageBalanceRows(filters);

  if (error) return { data: null, error };

  return { data: groupBalanceRows(data ?? [], 'lot_no'), error: null };
}
