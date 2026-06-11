import { INVOICE_DRAFT_STATUS } from './billingInvoiceDraftUtils.js';

export const BPLUS_EXPORT_READINESS_STATUS = Object.freeze({
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
});

export const EXPORT_PREVIEWABLE_DRAFT_STATUSES = Object.freeze([
  INVOICE_DRAFT_STATUS.APPROVED,
]);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MOVEMENT_TYPE_TO_BPLUS_SERVICE = Object.freeze({
  RECEIVE_CONFIRM: 'INBOUND_HANDLING',
  DISPATCH_CONFIRM: 'OUTBOUND_HANDLING',
  PUTAWAY_CONFIRM: 'INBOUND_HANDLING',
});

export function deriveBplusBillingPeriod(draft = {}) {
  const source = draft.billing_period_end ?? draft.billing_period_start ?? draft.updated_at ?? draft.created_at;
  if (!source) return null;

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function inferBplusServiceCode(movementType = '') {
  return MOVEMENT_TYPE_TO_BPLUS_SERVICE[movementType] ?? null;
}

export function buildInvoiceDraftBplusHeaderPreview(draft = {}, customer = null) {
  const approvedAtFallback = draft.updated_at ?? null;
  return {
    draft_no: draft.draft_no ?? null,
    customer_name: draft.customer_name ?? customer?.customer_name ?? customer?.name ?? null,
    customer_code: customer?.customer_code ?? null,
    billing_period: deriveBplusBillingPeriod(draft),
    total_chargeable_weight: toNumber(draft.total_chargeable_weight),
    total_amount: draft.total_amount == null ? null : toNumber(draft.total_amount),
    currency: draft.currency ?? 'THB',
    status: draft.status ?? null,
    approved_at: draft.approved_at ?? approvedAtFallback,
    approved_by: draft.approved_by ?? null,
    approved_at_source: draft.approved_at ? 'approved_at' : (approvedAtFallback ? 'updated_at_fallback' : 'missing'),
  };
}

export function buildInvoiceDraftBplusLinePreview(line = {}) {
  const chargeableWeight = toNumber(line.chargeable_weight);
  const rate = line.rate == null ? null : toNumber(line.rate);
  const amount = line.amount == null ? null : toNumber(line.amount);
  const inferredServiceCode = inferBplusServiceCode(line.movement_type);
  const lineWarnings = [];

  if (!inferredServiceCode) {
    lineWarnings.push('Bplus service code inferred from movement_type is pending accounting confirmation.');
  }

  if (rate == null || amount == null) {
    lineWarnings.push('Rate or amount is missing; preview shows weight-only information until pricing is confirmed.');
  }

  return {
    product_code: line.product_code ?? null,
    product_name: line.product_name ?? null,
    lot_no: line.lot_no ?? null,
    pallet_no: line.pallet_no ?? null,
    movement_type: line.movement_type ?? null,
    movement_date: line.movement_date ?? null,
    source_document_no: line.source_document_no ?? null,
    qty: toNumber(line.qty),
    uom: line.uom ?? null,
    net_weight: line.net_weight == null ? null : toNumber(line.net_weight),
    gross_weight: line.gross_weight == null ? null : toNumber(line.gross_weight),
    chargeable_weight: chargeableWeight,
    rate,
    amount,
    bplus_customer_code: null,
    bplus_service_code: inferredServiceCode,
    bplus_item_code: null,
    line_warnings: lineWarnings,
  };
}

export function evaluateInvoiceDraftBplusExportReadiness({
  draft = {},
  lines = [],
  customer = null,
} = {}) {
  const blockers = [];
  const warnings = [];

  if (!EXPORT_PREVIEWABLE_DRAFT_STATUSES.includes(draft.status)) {
    blockers.push(`Draft status must be APPROVED before Bplus export readiness preview (current: ${draft.status ?? 'UNKNOWN'}).`);
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    blockers.push('At least one invoice draft line is required.');
  }

  const customerCode = customer?.customer_code ?? null;
  if (!customerCode) {
    blockers.push('Customer code could not be resolved from master data.');
  }

  if (toNumber(draft.total_chargeable_weight) <= 0) {
    blockers.push('Total chargeable weight must be greater than zero.');
  }

  let hasAmountGap = false;
  let hasInferredMapping = false;

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const chargeableWeight = toNumber(line.chargeable_weight);

    if (!line.product_code) {
      blockers.push(`Line ${lineNo}: product_code is required.`);
    }

    if (chargeableWeight <= 0) {
      blockers.push(`Line ${lineNo}: chargeable_weight must be greater than zero.`);
    }

    const rate = line.rate == null ? null : toNumber(line.rate);
    const amount = line.amount == null ? null : toNumber(line.amount);
    if (rate == null || amount == null) {
      hasAmountGap = true;
    }

    if (!inferBplusServiceCode(line.movement_type)) {
      hasInferredMapping = true;
    }
  });

  if (!draft.approved_at) {
    warnings.push('approved_at is not stored yet; using updated_at as preview fallback.');
  }

  if (!draft.approved_by) {
    warnings.push('approved_by is not stored yet.');
  }

  warnings.push('Bplus import file format is pending confirmation from accounting.');
  warnings.push('VAT code and revenue account mapping are pending confirmation.');
  warnings.push('bplus_item_code mapping is not configured yet.');

  if (hasInferredMapping) {
    warnings.push('One or more lines use movement_type values without a confirmed Bplus service mapping.');
  }

  if (hasAmountGap) {
    warnings.push('One or more lines are missing rate or amount; export preview remains weight-only until pricing is confirmed.');
  }

  const headerPreview = buildInvoiceDraftBplusHeaderPreview(draft, customer);
  const linePreviews = lines.map((line) => buildInvoiceDraftBplusLinePreview(line));

  let readinessStatus = BPLUS_EXPORT_READINESS_STATUS.READY;

  if (blockers.length > 0) {
    readinessStatus = BPLUS_EXPORT_READINESS_STATUS.BLOCKED;
  } else if (hasAmountGap || hasInferredMapping) {
    readinessStatus = BPLUS_EXPORT_READINESS_STATUS.NEEDS_REVIEW;
  }

  const ready = readinessStatus === BPLUS_EXPORT_READINESS_STATUS.READY;

  return {
    readiness_status: readinessStatus,
    ready,
    blockers,
    warnings,
    header_preview: headerPreview,
    line_previews: linePreviews,
    preview: {
      target_system: 'Bplus',
      billing_period: headerPreview.billing_period,
      header: headerPreview,
      rows: linePreviews,
    },
  };
}
