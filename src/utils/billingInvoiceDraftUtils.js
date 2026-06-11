import { BILLING_STATUS_FOUNDATION } from './billingWeightUtils.js';

export const INVOICE_DRAFT_TABLE = 'tgd_billing_invoice_drafts';
export const INVOICE_DRAFT_LINE_TABLE = 'tgd_billing_invoice_draft_lines';

export const INVOICE_DRAFT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  READY_TO_REVIEW: 'READY_TO_REVIEW',
  APPROVED: 'APPROVED',
  EXPORTED_TO_BPLUS: 'EXPORTED_TO_BPLUS',
  CANCELLED: 'CANCELLED',
  BILLED: 'BILLED',
  ON_HOLD: 'ON_HOLD',
});

export const ACTIVE_INVOICE_DRAFT_STATUSES = Object.freeze([
  INVOICE_DRAFT_STATUS.DRAFT,
  INVOICE_DRAFT_STATUS.READY_TO_REVIEW,
  INVOICE_DRAFT_STATUS.APPROVED,
  INVOICE_DRAFT_STATUS.EXPORTED_TO_BPLUS,
]);

export const CANCELLABLE_INVOICE_DRAFT_STATUSES = Object.freeze([
  INVOICE_DRAFT_STATUS.DRAFT,
  INVOICE_DRAFT_STATUS.READY_TO_REVIEW,
]);

export const BILLABLE_SOURCE_BILLING_STATUSES = Object.freeze([
  BILLING_STATUS_FOUNDATION.READY_FOR_PREVIEW,
]);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function buildBillingInvoiceDraftNo(sequence = 1, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  const ymd = `${year}${month}${day}`;
  return `BID-${ymd}-${String(sequence).padStart(4, '0')}`;
}

export function shapeBillingInvoiceDraftHeader(row = {}) {
  return {
    id: row.id ?? null,
    draft_no: row.draft_no ?? null,
    customer_id: row.customer_id ?? null,
    customer_name: row.customer_name ?? null,
    billing_period_start: row.billing_period_start ?? null,
    billing_period_end: row.billing_period_end ?? null,
    status: row.status ?? INVOICE_DRAFT_STATUS.DRAFT,
    total_qty: toNumber(row.total_qty),
    total_net_weight: toNumber(row.total_net_weight),
    total_gross_weight: toNumber(row.total_gross_weight),
    total_chargeable_weight: toNumber(row.total_chargeable_weight),
    total_amount: row.total_amount == null ? null : toNumber(row.total_amount),
    currency: row.currency ?? 'THB',
    note: row.note ?? null,
    internal_reference: row.internal_reference ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    cancelled_by: row.cancelled_by ?? null,
    cancel_reason: row.cancel_reason ?? null,
  };
}

export function shapeBillingInvoiceDraftLine(row = {}) {
  return {
    id: row.id ?? null,
    invoice_draft_id: row.invoice_draft_id ?? null,
    source_movement_id: row.source_movement_id ?? null,
    source_document_no: row.source_document_no ?? null,
    source_document_type: row.source_document_type ?? null,
    customer_id: row.customer_id ?? null,
    product_id: row.product_id ?? null,
    product_code: row.product_code ?? null,
    product_name: row.product_name ?? null,
    lot_no: row.lot_no ?? null,
    pallet_no: row.pallet_no ?? null,
    movement_type: row.movement_type ?? null,
    movement_date: row.movement_date ?? null,
    qty: toNumber(row.qty),
    uom: row.uom ?? null,
    net_weight: row.net_weight == null ? null : toNumber(row.net_weight),
    gross_weight: row.gross_weight == null ? null : toNumber(row.gross_weight),
    chargeable_weight: row.chargeable_weight == null ? null : toNumber(row.chargeable_weight),
    billing_status: row.billing_status ?? null,
    rate: row.rate == null ? null : toNumber(row.rate),
    amount: row.amount == null ? null : toNumber(row.amount),
    line_note: row.line_note ?? null,
    duplicate_guard_active: row.duplicate_guard_active !== false,
    created_at: row.created_at ?? null,
  };
}

export function buildInvoiceDraftLineFromMovement(movement = {}, invoiceDraftId = null) {
  const rate = movement.rate == null ? null : toNumber(movement.rate);
  const chargeableWeight = toNumber(movement.chargeable_weight);
  const amount = rate == null ? null : rate * chargeableWeight;

  return {
    invoice_draft_id: invoiceDraftId,
    source_movement_id: movement.movement_id,
    source_document_no: movement.source_document_no ?? null,
    source_document_type: movement.source_document_type ?? null,
    customer_id: movement.customer_id,
    product_id: movement.product_id ?? null,
    product_code: movement.product_code ?? null,
    product_name: movement.product_name ?? null,
    lot_no: movement.lot_no ?? null,
    pallet_no: movement.pallet_no ?? null,
    movement_type: movement.movement_type ?? movement.canonical_movement_type ?? null,
    movement_date: movement.movement_date ?? null,
    qty: toNumber(movement.qty),
    uom: movement.uom ?? null,
    net_weight: movement.net_weight == null ? null : toNumber(movement.net_weight),
    gross_weight: movement.gross_weight == null ? null : toNumber(movement.gross_weight),
    chargeable_weight: chargeableWeight,
    billing_status: movement.billing_status ?? null,
    rate,
    amount,
    line_note: movement.line_note ?? null,
    duplicate_guard_active: true,
  };
}

export function calculateInvoiceDraftTotals(lines = []) {
  const totals = lines.reduce((acc, line) => {
    acc.total_qty += toNumber(line.qty);
    acc.total_net_weight += toNumber(line.net_weight);
    acc.total_gross_weight += toNumber(line.gross_weight);
    acc.total_chargeable_weight += toNumber(line.chargeable_weight);
    if (line.amount != null) {
      acc.total_amount += toNumber(line.amount);
      acc.has_amount = true;
    }
    return acc;
  }, {
    total_qty: 0,
    total_net_weight: 0,
    total_gross_weight: 0,
    total_chargeable_weight: 0,
    total_amount: 0,
    has_amount: false,
  });

  return {
    total_qty: totals.total_qty,
    total_net_weight: totals.total_net_weight,
    total_gross_weight: totals.total_gross_weight,
    total_chargeable_weight: totals.total_chargeable_weight,
    total_amount: totals.has_amount ? totals.total_amount : null,
  };
}

export function validateInvoiceDraftSourceRows(rows = []) {
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      valid: false,
      errors: ['At least one billing movement row is required.'],
      customerId: null,
      customerName: null,
    };
  }

  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  if (customerIds.length !== 1) {
    errors.push('All selected movements must belong to the same customer.');
  }

  rows.forEach((row) => {
    const movementId = row.movement_id ?? row.id ?? 'unknown';

    if (!row.is_billable) {
      errors.push(`Movement ${movementId} is not billable.`);
    }

    if (row.billing_status === BILLING_STATUS_FOUNDATION.EXCLUDED) {
      errors.push(`Movement ${movementId} is excluded from billing.`);
    }

    if (row.billing_status === BILLING_STATUS_FOUNDATION.NEEDS_WEIGHT_REVIEW) {
      errors.push(`Movement ${movementId} needs weight review before invoice draft creation.`);
    }

    if (!BILLABLE_SOURCE_BILLING_STATUSES.includes(row.billing_status)) {
      errors.push(`Movement ${movementId} has unsupported billing status ${row.billing_status ?? 'UNKNOWN'}.`);
    }

    const chargeableWeight = toNumber(row.chargeable_weight);
    const grossWeight = toNumber(row.gross_weight);
    const netWeight = toNumber(row.net_weight);
    if (chargeableWeight <= 0 && grossWeight <= 0 && netWeight <= 0) {
      errors.push(`Movement ${movementId} has incomplete weight data.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    customerId: customerIds[0] ?? null,
    customerName: rows.find((row) => row.customer_id === customerIds[0])?.customer_name ?? null,
  };
}

export function findDuplicateDraftLines(movementIds = [], activeDraftLines = []) {
  const requested = new Set((movementIds ?? []).map((id) => String(id)));
  const duplicates = [];

  (activeDraftLines ?? []).forEach((line) => {
    if (!line?.duplicate_guard_active) return;
    const sourceId = String(line.source_movement_id ?? '');
    if (requested.has(sourceId)) {
      duplicates.push({
        source_movement_id: line.source_movement_id,
        invoice_draft_id: line.invoice_draft_id ?? null,
        line_id: line.id ?? null,
      });
    }
  });

  return duplicates;
}

export function canCancelBillingInvoiceDraft(draft = {}) {
  return CANCELLABLE_INVOICE_DRAFT_STATUSES.includes(draft.status);
}

export function getMovementDraftSelectionState(row = {}) {
  if (!row.is_billable) {
    return { selectable: false, reason: 'Not billable' };
  }

  if (row.billing_status === BILLING_STATUS_FOUNDATION.EXCLUDED) {
    return { selectable: false, reason: 'Excluded from billing' };
  }

  if (row.billing_status === BILLING_STATUS_FOUNDATION.NEEDS_WEIGHT_REVIEW) {
    return { selectable: false, reason: 'Needs weight review' };
  }

  if (!BILLABLE_SOURCE_BILLING_STATUSES.includes(row.billing_status)) {
    return { selectable: false, reason: `Unsupported status: ${row.billing_status ?? 'UNKNOWN'}` };
  }

  const chargeableWeight = toNumber(row.chargeable_weight);
  const grossWeight = toNumber(row.gross_weight);
  const netWeight = toNumber(row.net_weight);
  if (chargeableWeight <= 0 && grossWeight <= 0 && netWeight <= 0) {
    return { selectable: false, reason: 'Incomplete weight data' };
  }

  return { selectable: true, reason: null };
}

export function formatInvoiceDraftError(error) {
  if (!error) return 'Unknown invoice draft error.';
  if (error.code === 'INVOICE_DRAFT_VALIDATION') {
    if (Array.isArray(error.details?.errors) && error.details.errors.length) {
      return error.details.errors.join(' ');
    }
    return error.message;
  }
  return error.message || String(error);
}

export function buildInvoiceDraftCreatePayload({
  draftNo,
  movements = [],
  billingPeriodStart = null,
  billingPeriodEnd = null,
  note = null,
  internalReference = null,
  createdBy = null,
}) {
  const validation = validateInvoiceDraftSourceRows(movements);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, header: null, lines: null };
  }

  const lines = movements.map((movement) => buildInvoiceDraftLineFromMovement(movement));
  const totals = calculateInvoiceDraftTotals(lines);

  return {
    valid: true,
    errors: [],
    header: {
      draft_no: draftNo,
      customer_id: validation.customerId,
      customer_name: validation.customerName,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      status: INVOICE_DRAFT_STATUS.DRAFT,
      ...totals,
      currency: 'THB',
      note,
      internal_reference: internalReference,
      created_by: createdBy,
    },
    lines,
  };
}
