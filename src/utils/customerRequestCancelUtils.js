const CUSTOMER_DEPOSIT_CANCEL_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
]);

const CUSTOMER_WITHDRAWAL_CANCEL_STATUSES = new Set([
  'WITHDRAWAL_DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
]);

const TERMINAL_DEPOSIT_STATUSES = new Set([
  'ADMIN_REJECTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
  'CLOSED',
  'CANCELLED',
]);

const TERMINAL_WITHDRAWAL_STATUSES = new Set([
  'ADMIN_REJECTED',
  'LOADED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
  'CLOSED',
  'CANCELLED',
]);

const ADMIN_ROLES = new Set(['admin', 'accounting']);
const CUSTOMER_ROLES = new Set(['customer_admin', 'customer_user']);

export const DEFAULT_CUSTOMER_REQUEST_POLICY = {
  deposit_cancel_lead_days: 3,
  withdrawal_cancel_lead_days: 3,
};

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function meetsCancelLeadTime(scheduledDate, leadDays = 0) {
  const scheduled = parseDateOnly(scheduledDate);
  if (!scheduled) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minimumDate = new Date(today);
  minimumDate.setDate(minimumDate.getDate() + Number(leadDays ?? 0));

  return scheduled >= minimumDate;
}

function buildCancelEligibility({
  role,
  status,
  scheduledDate,
  leadDays,
  customerStatuses,
  terminalStatuses,
  draftStatus,
}) {
  if (terminalStatuses.has(status)) {
    return { canCancel: false, reasonKey: 'customer_request_cancel_terminal' };
  }

  if (ADMIN_ROLES.has(role)) {
    return { canCancel: true, reasonKey: null };
  }

  if (!CUSTOMER_ROLES.has(role)) {
    return { canCancel: false, reasonKey: 'customer_request_cancel_role_denied' };
  }

  if (!customerStatuses.has(status)) {
    return { canCancel: false, reasonKey: 'customer_request_cancel_status_denied' };
  }

  if (status !== draftStatus && !meetsCancelLeadTime(scheduledDate, leadDays)) {
    return {
      canCancel: false,
      reasonKey: 'customer_request_cancel_lead_time',
      leadDays,
    };
  }

  return { canCancel: true, reasonKey: null };
}

export function getDepositCancelEligibility(header, role, policy = DEFAULT_CUSTOMER_REQUEST_POLICY) {
  return buildCancelEligibility({
    role,
    status: header?.status,
    scheduledDate: header?.expected_arrival_date,
    leadDays: policy.deposit_cancel_lead_days,
    customerStatuses: CUSTOMER_DEPOSIT_CANCEL_STATUSES,
    terminalStatuses: TERMINAL_DEPOSIT_STATUSES,
    draftStatus: 'DRAFT',
  });
}

export function getWithdrawalCancelEligibility(header, role, policy = DEFAULT_CUSTOMER_REQUEST_POLICY) {
  return buildCancelEligibility({
    role,
    status: header?.status,
    scheduledDate: header?.requested_dispatch_date,
    leadDays: policy.withdrawal_cancel_lead_days,
    customerStatuses: CUSTOMER_WITHDRAWAL_CANCEL_STATUSES,
    terminalStatuses: TERMINAL_WITHDRAWAL_STATUSES,
    draftStatus: 'WITHDRAWAL_DRAFT',
  });
}

export function formatRequestWeight(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}`;
}
