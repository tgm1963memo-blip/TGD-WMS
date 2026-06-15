import { getCustomerStorageBalanceSummary } from './customerStorageBalanceReportService.js';
import { listCustomerDepositRequests } from './customerDepositRequestService.js';
import { listCustomerWithdrawalRequests } from './customerWithdrawalRequestService.js';

const PENDING_DEPOSIT_STATUSES = ['DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'];
const PENDING_WITHDRAWAL_STATUSES = ['WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'];

function formatActivityTimestamp(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function pickLatestActivity(deposits = [], withdrawals = []) {
  const candidates = [
    ...deposits.map((row) => row.last_action_at || row.updated_at || row.created_at),
    ...withdrawals.map((row) => row.last_action_at || row.updated_at || row.created_at),
  ].filter(Boolean);

  if (!candidates.length) return '-';

  const latest = candidates
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time)[0];

  return latest ? formatActivityTimestamp(latest.value) : '-';
}

export async function getCustomerPortalDashboardSummary(customerId) {
  const [depositResult, withdrawalResult, stockResult] = await Promise.all([
    listCustomerDepositRequests({ customerId, statusIn: PENDING_DEPOSIT_STATUSES }),
    listCustomerWithdrawalRequests({ customerId, statusIn: PENDING_WITHDRAWAL_STATUSES }),
    getCustomerStorageBalanceSummary({ customerId }),
  ]);

  const firstError = depositResult.error || withdrawalResult.error || stockResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  const deposits = depositResult.data ?? [];
  const withdrawals = withdrawalResult.data ?? [];

  return {
    data: {
      pendingDepositRequests: deposits.length,
      pendingWithdrawalRequests: withdrawals.length,
      availableStockLots: Number(stockResult.data?.lot_count ?? 0),
      lastActivity: pickLatestActivity(deposits, withdrawals),
    },
    error: null,
  };
}
