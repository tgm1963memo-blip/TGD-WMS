// Badge tone for deposit and withdrawal request statuses. One colour per stage
// of the work, so a list can be read by colour: waiting on us, under review,
// accepted, in the warehouse, handed over, done, stopped, or needs attention.
const STATUS_TONES = {
  DRAFT: 'draft',
  WITHDRAWAL_DRAFT: 'draft',
  SUBMITTED_BY_CUSTOMER: 'submitted',
  ADMIN_REVIEWING: 'reviewing',
  ADMIN_ACCEPTED: 'accepted',
  WAREHOUSE_PICKING: 'working',
  WAREHOUSE_RECEIVING: 'working',
  PALLETIZING: 'working',
  DISPATCHED: 'shipped',
  RECEIVED_CONFIRMED: 'shipped',
  COMPLETED: 'done',
  CUSTOMER_NOTIFIED: 'done',
  CLOSED: 'done',
  ADMIN_REJECTED: 'stopped',
  REJECTED: 'stopped',
  CANCELLED: 'stopped',
  RECEIVING_VARIANCE: 'attention',
  COUNT_VARIANCE_REVIEW: 'attention',
  RECOUNT_REQUESTED: 'attention',
};

export function getCustomerRequestStatusClass(status) {
  return STATUS_TONES[status] ?? 'hold';
}
