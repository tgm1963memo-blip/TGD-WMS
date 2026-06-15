import { listCustomerDepositRequests } from './customerDepositRequestService.js';
import { listCustomerWithdrawalRequests } from './customerWithdrawalRequestService.js';

function mapDepositRow(row) {
  return {
    id: row.id,
    request_no: row.request_no,
    request_type: 'DEPOSIT',
    status: row.status,
    requested_date: row.expected_arrival_date ?? '-',
    note: row.note ?? '-',
    latest_action_note: row.last_action_by_email ? `Last action by ${row.last_action_by_email}` : '-',
    last_updated_at: row.last_action_at ?? row.updated_at ?? row.created_at,
    document_type: 'CUSTOMER_DEPOSIT_REQUEST',
  };
}

function mapWithdrawalRow(row) {
  return {
    id: row.id,
    request_no: row.withdrawal_no,
    request_type: 'WITHDRAWAL',
    status: row.status,
    requested_date: row.requested_dispatch_date ?? '-',
    note: row.note ?? '-',
    latest_action_note: row.last_action_by_email ? `Last action by ${row.last_action_by_email}` : '-',
    last_updated_at: row.last_action_at ?? row.updated_at ?? row.created_at,
    document_type: 'CUSTOMER_WITHDRAWAL_REQUEST',
  };
}

export async function listCustomerPortalRequestHistory(customerId) {
  const [depositResult, withdrawalResult] = await Promise.all([
    listCustomerDepositRequests({ customerId }),
    listCustomerWithdrawalRequests({ customerId }),
  ]);

  const firstError = depositResult.error || withdrawalResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  const rows = [
    ...(depositResult.data ?? []).map(mapDepositRow),
    ...(withdrawalResult.data ?? []).map(mapWithdrawalRow),
  ].sort((left, right) => {
    const leftTime = new Date(left.last_updated_at ?? 0).getTime();
    const rightTime = new Date(right.last_updated_at ?? 0).getTime();
    return rightTime - leftTime;
  });

  return { data: rows, error: null };
}
