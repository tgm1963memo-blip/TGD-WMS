import { supabase } from './supabaseClient.js';
import { getCustomerStockBalance } from './customerDepositRequestService.js';

const PENDING_DEPOSIT_STATUSES = ['DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'];
const PENDING_WITHDRAWAL_STATUSES = ['WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'];

async function countPendingDeposits(customerId) {
  if (!supabase) return { count: 0, error: null };
  const { count, error } = await supabase
    .from('tgd_customer_deposit_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .in('status', PENDING_DEPOSIT_STATUSES);
  return { count: count ?? 0, error };
}

async function countPendingWithdrawals(customerId) {
  if (!supabase) return { count: 0, error: null };
  const { count, error } = await supabase
    .from('tgd_customer_withdrawal_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .in('status', PENDING_WITHDRAWAL_STATUSES);
  return { count: count ?? 0, error };
}

export async function getCustomerPortalDashboardSummary(customerId) {
  // getAllCustomerStockBalances (used by the cross-customer admin storage
  // report) requires an admin/staff role — calling it here for a real
  // customer_user/customer_admin viewing their OWN portal home page fails
  // outright with "Insufficient role to view all customer stock balances"
  // before any per-customer filtering even happens. This widget only ever
  // needs this one customer's own balance, so use the customer-scoped RPC
  // (same one CustomerStockBalancePage already uses) instead.
  const [depositResult, withdrawalResult, stockResult] = await Promise.all([
    countPendingDeposits(customerId),
    countPendingWithdrawals(customerId),
    getCustomerStockBalance(customerId),
  ]);

  const firstError = depositResult.error || withdrawalResult.error || stockResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  const lotNos = new Set(
    (stockResult.data ?? []).map((row) => row.lot_no).filter(Boolean)
  );

  return {
    data: {
      pendingDepositRequests: depositResult.count,
      pendingWithdrawalRequests: withdrawalResult.count,
      availableStockLots: lotNos.size,
      lastActivity: '-',
    },
    error: null,
  };
}
