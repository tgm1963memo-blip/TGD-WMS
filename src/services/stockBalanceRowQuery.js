const EXTENDED_SELECT = 'id, customer_id, product_id, lot_id, warehouse_id, location_id, pallet_id, qty_on_hand, qty_allocated, qty_available, uom, created_at';
const LEGACY_SELECT = 'id, customer_id, product_id, lot_id, location_id, quantity, weight, created_at, updated_at';

function isMissingColumnError(error, columnName) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('does not exist');
}

function shouldFallbackToLegacySelect(error) {
  if (!error) return false;
  return (
    isMissingColumnError(error, 'warehouse_id')
    || isMissingColumnError(error, 'qty_on_hand')
    || isMissingColumnError(error, 'qty_allocated')
    || isMissingColumnError(error, 'qty_available')
    || isMissingColumnError(error, 'pallet_id')
    || isMissingColumnError(error, 'uom')
  );
}

export function normalizeStockBalanceRow(row = {}) {
  const qtyOnHand = Number(row.qty_on_hand ?? row.quantity ?? 0);
  const qtyAllocated = Number(row.qty_allocated ?? 0);
  const qtyAvailable = row.qty_available ?? (qtyOnHand - qtyAllocated);

  return {
    ...row,
    warehouse_id: row.warehouse_id ?? null,
    pallet_id: row.pallet_id ?? null,
    qty_on_hand: qtyOnHand,
    qty_allocated: qtyAllocated,
    qty_available: Number(qtyAvailable),
    uom: row.uom ?? null,
    created_at: row.created_at ?? row.updated_at ?? null,
  };
}

export async function queryStockBalanceRows(supabase, filters = {}, applyFilters) {
  const runQuery = (selectClause, includeWarehouseFilter) => {
    const baseQuery = supabase
      .from('tgd_stock_balances')
      .select(selectClause)
      .order('created_at', { ascending: false });

    const scopedFilters = includeWarehouseFilter
      ? filters
      : { ...filters, warehouseId: undefined };

    return applyFilters(baseQuery, scopedFilters);
  };

  let result = await runQuery(EXTENDED_SELECT, true);

  if (shouldFallbackToLegacySelect(result.error)) {
    result = await runQuery(LEGACY_SELECT, false);
  }

  if (result.error) {
    return result;
  }

  return {
    ...result,
    data: (result.data ?? []).map(normalizeStockBalanceRow),
  };
}
