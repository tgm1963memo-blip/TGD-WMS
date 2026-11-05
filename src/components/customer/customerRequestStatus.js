// Badge tone for deposit and withdrawal request statuses. Withdrawal
// statuses used to fall through to 'hold', so a completed withdrawal showed
// the same amber as one still waiting.
export function getCustomerRequestStatusClass(status) {
  if (status === 'DRAFT' || status === 'WITHDRAWAL_DRAFT') return 'draft';
  if (status === 'SUBMITTED_BY_CUSTOMER' || status === 'ADMIN_REVIEWING') return 'open';
  if (status === 'ADMIN_ACCEPTED' || status === 'WAREHOUSE_PICKING') return 'open';
  if (status === 'RECEIVED_CONFIRMED' || status === 'CUSTOMER_NOTIFIED' || status === 'CLOSED') return 'success';
  if (status === 'DISPATCHED' || status === 'COMPLETED') return 'success';
  if (status === 'ADMIN_REJECTED' || status === 'CANCELLED') return 'blocked';
  if (status === 'RECEIVING_VARIANCE' || status === 'COUNT_VARIANCE_REVIEW') return 'warning';
  return 'hold';
}
