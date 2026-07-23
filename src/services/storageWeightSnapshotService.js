import { getAllCustomerStockBalances } from './customerDepositRequestService.js';
import { getCustomers } from './masterDataService.js';
import { toLiveStockBalanceRows } from '../utils/liveStockBalanceRows.js';

// Reads the same live, freshly-computed balance the "ยอดคงเหลือ" pages use
// (see liveStockBalanceRows.js) instead of the separately-maintained
// per-location stock ledger table this used to read, which could disagree with
// ยอดคงเหลือ for the same product/customer. Also: the previous version never
// actually filtered by filters.dateFrom/dateTo despite the page passing
// them — this was always a point-in-time current-balance read, not a real
// historical snapshot, so switching data source loses no working
// historical capability.
function applyRowFilters(rows, filters = {}) {
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

function groupByKey(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      qty_boxes: 0,
      weight: 0,
      chargeable_weight: 0,
      row_count: 0,
    };

    current.qty_boxes += Number(row.qty_boxes ?? 0);
    current.weight += Number(row.qty_weight ?? 0);
    current.chargeable_weight += Number(row.chargeable_weight ?? 0);
    current.row_count += 1;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

export async function getDailyStorageWeightPreview(filters = {}) {
  const [balanceResult, customersResult] = await Promise.all([
    getAllCustomerStockBalances(),
    getCustomers(),
  ]);

  if (balanceResult.error) return { data: null, error: balanceResult.error };
  if (customersResult.error) return { data: null, error: customersResult.error };

  const rows = toLiveStockBalanceRows(balanceResult.data ?? [], customersResult.data ?? []);
  return { data: applyRowFilters(rows, filters), error: null };
}

export async function getMonthlyStorageWeightPreview(filters = {}) {
  const { data, error } = await getDailyStorageWeightPreview(filters);

  if (error) return { data: null, error };

  return {
    data: calculateChargeableWeight(data ?? [], {
      minimumWeight: filters.minimumWeight,
    }),
    error: null,
  };
}

export function calculateChargeableWeight(rows = [], options = {}) {
  const minimumWeight = Number(options.minimumWeight ?? 0);

  return rows.map((row) => {
    const calculatedWeight = Number(row.qty_weight ?? 0);
    const chargeableWeight = Math.max(calculatedWeight, minimumWeight);

    return {
      ...row,
      calculated_weight: calculatedWeight,
      chargeable_weight: chargeableWeight,
    };
  });
}

export function groupStorageWeightByCustomer(rows = []) {
  return groupByKey(rows, 'customer_name');
}

export function groupStorageWeightByProduct(rows = []) {
  return groupByKey(rows, 'product_code');
}
