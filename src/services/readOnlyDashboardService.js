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

// tgd_putaway_documents does not exist in the current schema (superseded by tgd_putaway_tasks).
// This constant prevents a 404 console error from the dashboard summary query.
const PUTAWAY_ROWS_UNAVAILABLE = 0;

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

async function getActiveStockBalanceCount() {
  // Use qty_on_hand for count-only queries — PostgREST doesn't support filtering on
  // generated columns when using count:exact + head:true
  const { count, error } = await supabase
    .from('tgd_stock_balances')
    .select('*', { count: 'exact', head: true })
    .gt('qty_on_hand', 0);
  if (error) throw error;
  return count ?? 0;
}

async function getStockQuantityTotal() {
  const { data, error } = await supabase
    .from('tgd_stock_balances')
    .select('qty_on_hand, qty_allocated')
    .gt('qty_on_hand', 0);

  if (error) throw error;
  return (data ?? []).reduce((total, row) => {
    const net = Number(row.qty_on_hand || 0) - Number(row.qty_allocated || 0);
    return total + Math.max(0, net);
  }, 0);
}

async function getActiveLocationCount() {
  // Query locations directly — avoid FK-chain joins that require schema constraints
  const { count, error } = await supabase
    .from('tgd_locations')
    .select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
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
      openPickingRows,
      openDispatchRows,
    ] = await Promise.all([
      getActiveStockBalanceCount(),
      getRowCount('tgd_stock_movements'),
      getStockQuantityTotal(),
      getRowCount('tgd_customers'),
      getRowCount('tgd_products'),
      getRowCount('tgd_lots'),
      getActiveLocationCount(),
      getOpenDocumentCount('tgd_receiving_documents'),
      getOpenDocumentCount('tgd_picking_documents'),
      getOpenDocumentCount('tgd_dispatch_documents'),
    ]);
    const openPutawayRows = PUTAWAY_ROWS_UNAVAILABLE;

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

export async function getPendingAdminDocuments() {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };

  const [depositResult, withdrawalResult] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_requests')
      .select('id, request_no, status, submitted_at, created_at, customer:tgd_customers(customer_name, customer_code)')
      .eq('status', 'SUBMITTED_BY_CUSTOMER')
      .order('submitted_at', { ascending: true }),
    supabase
      .from('tgd_customer_withdrawal_requests')
      .select('id, request_no, status, submitted_at, created_at, customer:tgd_customers(customer_name, customer_code)')
      .eq('status', 'SUBMITTED_BY_CUSTOMER')
      .order('submitted_at', { ascending: true }),
  ]);

  if (depositResult.error || withdrawalResult.error) {
    return { data: null, error: depositResult.error ?? withdrawalResult.error };
  }

  const deposits = (depositResult.data ?? []).map((r) => ({ ...r, docType: 'deposit' }));
  const withdrawals = (withdrawalResult.data ?? []).map((r) => ({ ...r, docType: 'withdrawal' }));
  const all = [...deposits, ...withdrawals].sort((a, b) => {
    const da = a.submitted_at ?? a.created_at ?? '';
    const db = b.submitted_at ?? b.created_at ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return { data: all, error: null };
}
