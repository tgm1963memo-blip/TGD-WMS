export function getCustomerRequestStatusClass(status) {
  if (status === 'DRAFT' || status === 'WITHDRAWAL_DRAFT') return 'draft';
  if (status === 'SUBMITTED_BY_CUSTOMER' || status === 'ADMIN_REVIEWING') return 'open';
  return 'hold';
}
