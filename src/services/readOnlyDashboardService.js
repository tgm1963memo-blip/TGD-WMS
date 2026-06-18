import { resolveQuantity } from '../utils/stockFieldAliases.js';
import { supabase } from './supabaseClient.js';

const emptySummary = {
  stockBalanceRows: 0,
  stockMovementRows: 0,
  totalStockQuantity: 0,
  customerRows: 0,
  productRows: 0,
  lotRows: 0,
  locationRows: 0,
  openReceivingRows: 0,
  openPutawayRows: 0,
  openPickingRows: 0,
  openDispatchRows: 0,
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
  const quantityResult = await supabase
    .from('tgd_stock_balances')
    .select('quantity');

  if (!quantityResult.error) {
    return (quantityResult.data ?? []).reduce((total, row) => total + resolveQuantity(row), 0);
  }

  const legacyResult = await supabase
    .from('tgd_stock_balances')
    .select('qty_on_hand');

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data ?? []).reduce((total, row) => total + resolveQuantity(row), 0);
}

async function getOpenDocumentCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .in('status', ['OPEN', 'DRAFT']);

  if (error) {
    return 0;
  }

  return count ?? 0;
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
      openReceivingRows,
      openPutawayRows,
      openPickingRows,
      openDispatchRows,
    ] = await Promise.all([
      getRowCount('tgd_stock_balances'),
      getRowCount('tgd_stock_movements'),
      getStockQuantityTotal(),
      getRowCount('tgd_customers'),
      getRowCount('tgd_products'),
      getRowCount('tgd_lots'),
      getRowCount('tgd_locations'),
      getOpenDocumentCount('tgd_receiving_documents'),
      getOpenDocumentCount('tgd_putaway_documents'),
      getOpenDocumentCount('tgd_picking_documents'),
      getOpenDocumentCount('tgd_dispatch_documents'),
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
        openReceivingRows,
        openPutawayRows,
        openPickingRows,
        openDispatchRows,
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
