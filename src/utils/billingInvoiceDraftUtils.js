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

export const APPROVABLE_INVOICE_DRAFT_STATUSES = Object.freeze([
  INVOICE_DRAFT_STATUS.DRAFT,
  INVOICE_DRAFT_STATUS.READY_TO_REVIEW,
]);

// Hard-delete (not the soft CANCELLED transition) is only offered for plain
// DRAFT — once a draft has moved to READY_TO_REVIEW or beyond it's been
// seen/acted on, so cancel (which preserves an audit trail) is the right
// tool instead of removing the record outright.
export const DELETABLE_INVOICE_DRAFT_STATUSES = Object.freeze([
  INVOICE_DRAFT_STATUS.DRAFT,
  INVOICE_DRAFT_STATUS.CANCELLED,
]);

export const BILLABLE_SOURCE_BILLING_STATUSES = Object.freeze([
  BILLING_STATUS_FOUNDATION.READY_FOR_PREVIEW,
  'READY',
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
    temperature_type: row.temperature_type ?? null,
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
    service_rate_id: row.service_rate_id ?? null,
    period_days: row.period_days == null ? null : toNumber(row.period_days),
    storage_days: row.storage_days == null ? null : toNumber(row.storage_days),
    deposit_line_id: row.deposit_line_id ?? null,
    billing_period_start: row.billing_period_start ?? null,
    billing_period_end: row.billing_period_end ?? null,
    discount_amount: row.discount_amount == null ? null : toNumber(row.discount_amount),
    min_charge_applied: row.min_charge_applied ?? false,
    min_charge_topup_amount: row.min_charge_topup_amount == null ? null : toNumber(row.min_charge_topup_amount),
    free_period_applied: row.free_period_applied ?? false,
    adjustment_note: row.adjustment_note ?? null,
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
    service_rate_id: movement.service_rate_id ?? null,
    line_note: movement.line_note ?? null,
    duplicate_guard_active: true,
    // See the identical comment in buildInvoiceDraftLineFromHandlingLine --
    // same NOT NULL / heterogeneous-batch hazard if a movement-based line
    // is ever inserted in the same batch as a contract-adjusted line.
    min_charge_applied: false,
    free_period_applied: false,
  };
}

// Storage/auxiliary lines (see billingRateEngineService.js) have no single
// source movement — a storage charge spans a whole billing period, and an
// auxiliary service (container plug-in, overnight fee) attaches to a
// deposit request, not a movement — so source_movement_id stays null for
// these (see the 20260712090000 migration making that column nullable).
export function buildInvoiceDraftLineFromStorageLine(storageLine, depositLine = {}) {
  const rate = storageLine.rate ?? {};
  return {
    invoice_draft_id: null,
    source_movement_id: null,
    source_document_no: null,
    source_document_type: 'STORAGE',
    customer_id: storageLine.customerId,
    product_id: null,
    product_code: depositLine.customer_product_code ?? null,
    product_name: depositLine.customer_product_code ?? null,
    lot_no: depositLine.lot_no ?? null,
    pallet_no: null,
    movement_type: 'STORAGE',
    movement_date: null,
    qty: 0,
    uom: 'กก.',
    net_weight: storageLine.weight,
    gross_weight: storageLine.weight,
    chargeable_weight: storageLine.weight,
    billing_status: 'READY',
    rate: rate.rate != null ? toNumber(rate.rate) : null,
    amount: storageLine.amount,
    service_rate_id: rate.id ?? null,
    period_days: rate.period_days ?? null,
    storage_days: storageLine.days ?? null,
    deposit_line_id: storageLine.depositLineId ?? null,
    billing_period_start: storageLine.periodStart ?? null,
    billing_period_end: storageLine.periodEnd ?? null,
    // Contract-term adjustments (see billingRateCalc.js) — undefined on any
    // line whose rate has none of these terms set, so an ordinary rate
    // without contract fields inserts the exact same row shape as before.
    discount_amount: storageLine.discountAmount ?? null,
    min_charge_applied: storageLine.minChargeApplied ?? false,
    min_charge_topup_amount: storageLine.minChargeTopupAmount ?? null,
    free_period_applied: storageLine.freePeriodApplied ?? false,
    adjustment_note: storageLine.adjustmentNote ?? null,
    // One result row = exactly one full billed cycle (see
    // computeStorageInvoiceLines) — storageLine.weight is the weight on
    // hand right at that cycle's start, charged in full regardless of how
    // many days of the cycle have actually elapsed ("เต็มรอบทันที").
    line_note: [
      rate.period_days
        ? `ค่าฝาก 1 งวด (งวดละ ${rate.period_days} วัน: ${storageLine.periodStart ?? '-'} ถึง ${storageLine.periodEnd ?? '-'}, น้ำหนักที่คิดค่าฝาก ${storageLine.weight} กก.)`
        : 'ค่าฝาก (ครั้งเดียว)',
      storageLine.adjustmentNote,
    ].filter(Boolean).join(' — '),
    duplicate_guard_active: false,
  };
}

// HANDLING_IN (ค่าบริการจัดการแรกเข้า) lines have no single source movement
// either — same reasoning as storage/auxiliary lines above — and, unlike
// storage, are always a one-time charge (no period_days/storage_days).
export function buildInvoiceDraftLineFromHandlingLine(handlingLine, depositLine = {}) {
  const rate = handlingLine.rate ?? {};
  return {
    invoice_draft_id: null,
    source_movement_id: null,
    source_document_no: null,
    source_document_type: 'HANDLING_IN',
    customer_id: handlingLine.customerId,
    product_id: null,
    product_code: depositLine.customer_product_code ?? null,
    product_name: depositLine.customer_product_code ?? null,
    lot_no: depositLine.lot_no ?? null,
    pallet_no: null,
    movement_type: 'HANDLING_IN',
    movement_date: handlingLine.receiptDate ?? null,
    qty: 0,
    uom: 'กก.',
    net_weight: handlingLine.weight,
    gross_weight: handlingLine.weight,
    chargeable_weight: handlingLine.weight,
    billing_status: 'READY',
    rate: rate.rate != null ? toNumber(rate.rate) : null,
    amount: handlingLine.amount,
    service_rate_id: rate.id ?? null,
    period_days: null,
    storage_days: null,
    deposit_line_id: handlingLine.depositLineId ?? null,
    billing_period_start: null,
    billing_period_end: null,
    line_note: `ค่าบริการจัดการแรกเข้า (รับเข้า ${handlingLine.receiptDate ?? '-'}, น้ำหนัก ${handlingLine.weight} กก.)`,
    duplicate_guard_active: false,
    // Explicit false, not omitted: min_charge_applied/free_period_applied
    // are NOT NULL DEFAULT false columns, which covers a plain single-type
    // insert fine -- but createBillingInvoiceDraftForPeriod inserts every
    // period's lines (storage + handling + auxiliary) in ONE batch, and
    // PostgREST's bulk insert builds its column list from the union of
    // keys across the whole array; a row that omits a key present on ANY
    // other row in that same batch gets an explicit SQL NULL for it, not
    // the column's DEFAULT. Confirmed real gap: any customer with a
    // configured HANDLING_IN rate (e.g. real customer C002/บริษัท ไทย -
    // เยอรมัน มีท โปรดักท์) had EVERY period-based draft creation fail
    // outright with "null value in column min_charge_applied violates
    // not-null constraint" the moment a HANDLING_IN line shared a batch
    // with a STORAGE line (which already set this field).
    min_charge_applied: false,
    free_period_applied: false,
  };
}

// Subtotal-by-service-type breakdown for display/report purposes only —
// deliberately NOT part of calculateInvoiceDraftTotals below, whose output
// is spread directly into the tgd_billing_invoice_drafts insert row (i.e.
// its keys are real DB columns). This is fully re-derivable from `lines`
// at any time, so it's computed fresh wherever needed instead of persisted.
export function groupInvoiceDraftLinesByType(lines = []) {
  return lines.reduce((acc, line) => {
    const key = line.source_document_type ?? 'OTHER';
    acc[key] = (acc[key] ?? 0) + (Number(line.amount) || 0);
    return acc;
  }, {});
}

export function buildInvoiceDraftLineFromAuxiliaryLine(auxLine) {
  const rate = auxLine.rate ?? {};
  return {
    invoice_draft_id: null,
    source_movement_id: null,
    source_document_no: null,
    source_document_type: 'SERVICE',
    customer_id: auxLine.customerId,
    product_id: null,
    product_code: null,
    product_name: rate.note ?? rate.service_type ?? 'ค่าบริการเสริม',
    lot_no: null,
    pallet_no: null,
    movement_type: 'SERVICE',
    movement_date: null,
    qty: auxLine.quantity,
    uom: rate.unit_basis === 'PER_HOUR' ? 'ชม.' : rate.unit_basis === 'FLAT' ? 'ครั้ง' : rate.unit_basis,
    net_weight: null,
    gross_weight: null,
    chargeable_weight: null,
    billing_status: 'READY',
    rate: rate.rate != null ? toNumber(rate.rate) : null,
    amount: auxLine.amount,
    service_rate_id: rate.id ?? null,
    period_days: null,
    storage_days: null,
    line_note: auxLine.note ?? null,
    duplicate_guard_active: false,
    // See the identical comment in buildInvoiceDraftLineFromHandlingLine --
    // same NOT NULL / heterogeneous-batch hazard applies to a SERVICE line
    // sharing a batch with a STORAGE line.
    min_charge_applied: false,
    free_period_applied: false,
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

    // STORAGE charges (e.g. the STORAGE_OPENING_BALANCE "ยอดยกมา" rows shown on the
    // Billing Movement Weight Report) must never be billed through this
    // movement-based flow — it has no period/cycle context, so it can only ever
    // resolve a flat rate x weight amount, silently skipping the audited period-based
    // engine's minimum-charge floor, free-day grace period, discount percent, and
    // "เต็มรอบทันที ไม่เฉลี่ยตามวัน" cycle proration (see the matching comment on
    // RATE_SERVICE_TYPES in billingInvoiceDraftService.js). Blocked here rather than
    // left to silently produce a wrong/lower amount.
    if (String(row.billing_service_type ?? '').toUpperCase() === 'STORAGE') {
      errors.push(`Movement ${movementId} is a STORAGE charge and cannot be billed from this movement-based draft — use the period-based billing flow ("+ สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา" on Invoice Draft List) instead.`);
    }

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

export function applyActiveDuplicateDraftGuards(rows = [], activeDraftLines = []) {
  const guardedMovementIds = new Set(
    (activeDraftLines ?? [])
      .filter((line) => line?.duplicate_guard_active !== false)
      .map((line) => String(line.source_movement_id ?? ''))
      .filter(Boolean),
  );

  return (rows ?? []).map((row) => ({
    ...row,
    active_duplicate_guard: guardedMovementIds.has(String(row.movement_id ?? '')),
  }));
}

export function canCancelBillingInvoiceDraft(draft = {}) {
  return CANCELLABLE_INVOICE_DRAFT_STATUSES.includes(draft.status);
}

export function canDeleteBillingInvoiceDraft(draft = {}) {
  return DELETABLE_INVOICE_DRAFT_STATUSES.includes(draft.status);
}

export function canApproveBillingInvoiceDraft(draft = {}) {
  return APPROVABLE_INVOICE_DRAFT_STATUSES.includes(draft.status);
}

// Same editable window as cancel — once a draft moves past DRAFT/
// READY_TO_REVIEW its line amounts shouldn't be silently rewritten anymore.
export function canRecalculateBillingInvoiceDraft(draft = {}) {
  return CANCELLABLE_INVOICE_DRAFT_STATUSES.includes(draft.status);
}

export function getMovementDraftSelectionState(row = {}) {
  if (row.active_duplicate_guard) {
    return { selectable: false, reason: 'Already linked to an active invoice draft' };
  }

  // See the matching comment in validateInvoiceDraftSourceRows above — a STORAGE row
  // has no period/cycle context on this movement-based path, so it must not be
  // selectable here at all (not just rejected after the fact) to keep staff from
  // ever building a STORAGE line with the wrong (flat-rate) amount.
  if (String(row.billing_service_type ?? '').toUpperCase() === 'STORAGE') {
    return { selectable: false, reason: 'STORAGE charges must be created via the period-based billing flow' };
  }

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

export function isBillingInvoiceDraftPermissionError(error) {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? error.details ?? '');
  return code === '42501'
    || code === 'INVOICE_DRAFT_PERMISSION_DENIED'
    || /permission denied|row-level security|violates row-level security|not authorized/i.test(message);
}

export function formatInvoiceDraftError(error) {
  if (!error) return 'Unknown invoice draft error.';
  if (isBillingInvoiceDraftPermissionError(error)) {
    return 'You do not have permission to access billing invoice drafts.';
  }
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
