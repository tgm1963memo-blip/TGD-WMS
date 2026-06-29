export function getCustomerRequestStatusClass(status) {
  if (status === 'DRAFT' || status === 'WITHDRAWAL_DRAFT') return 'draft';
  if (status === 'SUBMITTED_BY_CUSTOMER' || status === 'ADMIN_REVIEWING') return 'open';
  if (status === 'RECEIVED_CONFIRMED' || status === 'CUSTOMER_NOTIFIED' || status === 'CLOSED') return 'success';
  if (status === 'RECEIVING_VARIANCE' || status === 'COUNT_VARIANCE_REVIEW') return 'warning';
  return 'hold';
}
