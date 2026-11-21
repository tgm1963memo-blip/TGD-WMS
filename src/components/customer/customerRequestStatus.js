// Badge tone for deposit and withdrawal request statuses. One colour per stage
// of the work, so a list can be read by colour: waiting on us, under review,
// accepted, in the warehouse, handed over, done, stopped, or needs attention.
const STATUS_TONES = {
  DRAFT: 'draft',
  WITHDRAWAL_DRAFT: 'draft',
  DEPOSIT_DRAFT: 'draft',
  SUBMITTED_BY_CUSTOMER: 'submitted',
  ADMIN_REVIEWING: 'reviewing',
  ADMIN_ACCEPTED: 'accepted',
  WAREHOUSE_PICKING: 'working',
  WAREHOUSE_RECEIVING: 'working',
  PALLETIZING: 'working',
  PICKED: 'working',
  PACKING_LIST_RECORDED: 'working',
  LOADING: 'working',
  DISPATCHED: 'shipped',
  COMPLETED: 'done',
  LOADED_CONFIRMED: 'done',
  RECEIVED_CONFIRMED: 'done',
  CUSTOMER_NOTIFIED: 'done',
  CLOSED: 'done',
  ADMIN_REJECTED: 'stopped',
  REJECTED: 'stopped',
  CANCELLED: 'stopped',
  RECEIVING_VARIANCE: 'attention',
  COUNT_VARIANCE_REVIEW: 'attention',
  ADMIN_RECOUNT_REQUESTED: 'attention',
};

export function getCustomerRequestStatusClass(status) {
  return STATUS_TONES[status] ?? 'hold';
}
