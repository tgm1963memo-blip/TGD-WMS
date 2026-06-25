export const CUSTOMER_WITHDRAWAL_STATUS_I18N_KEYS = {
  WITHDRAWAL_DRAFT: 'customer_withdrawal_status_draft',
  DRAFT: 'customer_withdrawal_status_draft',
  SUBMITTED_BY_CUSTOMER: 'customer_withdrawal_status_submitted',
  ADMIN_REVIEWING: 'customer_withdrawal_status_admin_reviewing',
  ADMIN_ACCEPTED: 'customer_withdrawal_status_admin_accepted',
  WAREHOUSE_PICKING: 'customer_withdrawal_status_warehouse_picking',
  ADMIN_REJECTED: 'customer_withdrawal_status_admin_rejected',
  REJECTED: 'customer_withdrawal_status_admin_rejected',
  DISPATCHED: 'customer_withdrawal_status_dispatched',
  COMPLETED: 'customer_withdrawal_status_completed',
  CANCELLED: 'customer_withdrawal_status_cancelled',
};

export function getWithdrawalStatusLabel(status, t) {
  const key = CUSTOMER_WITHDRAWAL_STATUS_I18N_KEYS[status];
  return key ? t(key) : status;
}
