import { CUSTOMER_DEPOSIT_STATUSES } from '../data/customerPortalDemoData.js';

export const CUSTOMER_DEPOSIT_STATUS_I18N_KEYS = {
  DRAFT: 'customer_deposit_status_draft',
  SUBMITTED_BY_CUSTOMER: 'customer_deposit_status_submitted',
  ADMIN_REVIEWING: 'customer_deposit_status_admin_reviewing',
  ADMIN_ACCEPTED: 'customer_deposit_status_admin_accepted',
  WAREHOUSE_RECEIVING: 'customer_deposit_status_warehouse_receiving',
  PALLETIZING: 'customer_deposit_status_palletizing',
  COUNT_VARIANCE_REVIEW: 'customer_deposit_status_count_variance',
  RECEIVING_VARIANCE: 'customer_deposit_status_receiving_variance',
  ADMIN_RECOUNT_REQUESTED: 'customer_deposit_status_recount_requested',
  RECEIVED_CONFIRMED: 'customer_deposit_status_received_confirmed',
  CUSTOMER_NOTIFIED: 'customer_deposit_status_customer_notified',
};

export function getDepositStatusLabel(status, t) {
  const key = CUSTOMER_DEPOSIT_STATUS_I18N_KEYS[status];
  return key ? t(key) : status;
}

export { CUSTOMER_DEPOSIT_STATUSES };
