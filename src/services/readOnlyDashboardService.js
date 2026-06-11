import { supabase } from './supabaseClient.js';

const emptySummary = {
  stockBalanceRows: 0,
  stockMovementRows: 0,
  totalStockQuantity: 0,
  customerRows: 0,
  productRows: 0,
  lotRows: 0,
  locationRows: 0,
};

function missingClientResult() {
  return {
    data: { ...emptySummary },
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

async function getRowCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getStockQuantityTotal() {
  const { data, error } = await supabase
    .from('tgd_stock_balances')
    .select('quantity, qty_on_hand, qty_available');

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((total, row) => {
    const quantity = Number(row.qty_on_hand ?? row.qty_available ?? row.quantity ?? 0);
    return total + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

export async function getReadOnlyDashboardSummary() {
  if (!supabase) {
    return missingClientResult();
  }

  try {
    const [
      stockBalanceRows,
      stockMovementRows,
      totalStockQuantity,
      customerRows,
      productRows,
      lotRows,
      locationRows,
    ] = await Promise.all([
      getRowCount('tgd_stock_balances'),
      getRowCount('tgd_stock_movements'),
      getStockQuantityTotal(),
      getRowCount('tgd_customers'),
      getRowCount('tgd_products'),
      getRowCount('tgd_lots'),
      getRowCount('tgd_locations'),
    ]);

    return {
      data: {
        stockBalanceRows,
        stockMovementRows,
        totalStockQuantity,
        customerRows,
        productRows,
        lotRows,
        locationRows,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: { ...emptySummary },
      error,
    };
  }
}

export function getReadOnlyDashboardEmptySummary() {
  return { ...emptySummary };
}
