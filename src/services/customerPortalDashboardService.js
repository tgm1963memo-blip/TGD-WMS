import { supabase } from './supabaseClient.js';
import { getCustomerStorageBalanceSummary } from './customerStorageBalanceReportService.js';

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
  const [depositResult, withdrawalResult, stockResult] = await Promise.all([
    countPendingDeposits(customerId),
    countPendingWithdrawals(customerId),
    getCustomerStorageBalanceSummary({ customerId }),
  ]);

  const firstError = depositResult.error || withdrawalResult.error || stockResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  return {
    data: {
      pendingDepositRequests: depositResult.count,
      pendingWithdrawalRequests: withdrawalResult.count,
      availableStockLots: Number(stockResult.data?.lot_count ?? 0),
      lastActivity: '-',
    },
    error: null,
  };
}
