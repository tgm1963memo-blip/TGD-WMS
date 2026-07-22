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

const CUSTOMER_DEPOSIT_RECALL_STATUSES = new Set([
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
]);

const CUSTOMER_WITHDRAWAL_RECALL_STATUSES = new Set([
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
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

// Recall (เรียกเอกสารกลับ) reopens a submitted deposit request for editing —
// only valid before the admin's ACCEPT decision bridges it into a real
// warehouse receiving document (tgd_bridge_customer_deposit_to_receiving,
// see tgd_recall_customer_deposit_request). No lead-time gate like cancel
// has: recalling doesn't abandon the shipment, it just pulls the
// still-pending request back to reopen editing, so there's no "too close
// to arrival" risk to guard against.
export function getDepositRecallEligibility(header, role) {
  const status = header?.status;

  if (ADMIN_ROLES.has(role)) {
    return { canRecall: CUSTOMER_DEPOSIT_RECALL_STATUSES.has(status), reasonKey: null };
  }

  if (!CUSTOMER_ROLES.has(role)) {
    return { canRecall: false, reasonKey: 'customer_request_recall_role_denied' };
  }

  if (!CUSTOMER_DEPOSIT_RECALL_STATUSES.has(status)) {
    return { canRecall: false, reasonKey: 'customer_request_recall_status_denied' };
  }

  return { canRecall: true, reasonKey: null };
}

// Same recall concept as getDepositRecallEligibility, for withdrawal
// requests — only valid before ADMIN_ACCEPTED bridges the request into a
// real warehouse picking document (tgd_bridge_customer_withdrawal_to_internal,
// see tgd_recall_customer_withdrawal_request).
export function getWithdrawalRecallEligibility(header, role) {
  const status = header?.status;

  if (ADMIN_ROLES.has(role)) {
    return { canRecall: CUSTOMER_WITHDRAWAL_RECALL_STATUSES.has(status), reasonKey: null };
  }

  if (!CUSTOMER_ROLES.has(role)) {
    return { canRecall: false, reasonKey: 'customer_request_recall_role_denied' };
  }

  if (!CUSTOMER_WITHDRAWAL_RECALL_STATUSES.has(status)) {
    return { canRecall: false, reasonKey: 'customer_request_recall_status_denied' };
  }

  return { canRecall: true, reasonKey: null };
}

export function formatRequestWeight(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}`;
}

// Mirrors the server's has_receipt_variance flag (round(x,3) <> round(y,3) —
// see tgd_review_customer_deposit_request), rather than comparing raw
// String(actual) !== String(expected). Without rounding first, two weights
// that are the same value to 3 decimal places but arrived via different
// float arithmetic paths (e.g. 100.45 vs 100.44999999999999) show up as a
// variance here even though the server-computed flag on the list page
// says there isn't one.
export function hasWeightVariance(actual, expected) {
  if (actual == null || expected == null) return false;
  const a = Math.round(Number(actual) * 1000) / 1000;
  const b = Math.round(Number(expected) * 1000) / 1000;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return String(actual) !== String(expected);
  return a !== b;
}
