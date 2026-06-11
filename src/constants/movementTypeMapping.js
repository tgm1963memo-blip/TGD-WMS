import { MOVEMENT_TYPES } from './movementTypes.js';

export const STOCK_LEDGER_SOURCE = 'stock_ledger';
export const INVENTORY_LEDGER_SOURCE = 'inventory_ledger';

export const BILLING_EXCLUSION_REASONS = Object.freeze({
  NONE: null,
  DRAFT_MOVEMENT: 'DRAFT_MOVEMENT',
  REVERSED_MOVEMENT: 'REVERSED_MOVEMENT',
  NON_BILLABLE_TYPE: 'NON_BILLABLE_TYPE',
  MISSING_TRACEABILITY: 'MISSING_TRACEABILITY',
  TRANSFER_NOT_CONFIGURED: 'TRANSFER_NOT_CONFIGURED',
  PICK_NOT_FINAL_DISPATCH: 'PICK_NOT_FINAL_DISPATCH',
  OPENING_BALANCE: 'OPENING_BALANCE',
  ADJUSTMENT_DEFAULT_EXCLUDED: 'ADJUSTMENT_DEFAULT_EXCLUDED',
});

export const BILLING_SERVICE_TYPES = Object.freeze({
  INBOUND_HANDLING: 'INBOUND_HANDLING',
  OUTBOUND_HANDLING: 'OUTBOUND_HANDLING',
  STORAGE: 'STORAGE',
  TRANSFER: 'TRANSFER',
  STOCK_COUNT: 'STOCK_COUNT',
  SPECIAL_HANDLING: 'SPECIAL_HANDLING',
  MANUAL_CHARGE: 'MANUAL_CHARGE',
  NON_BILLABLE: 'NON_BILLABLE',
});

const STOCK_TO_CANONICAL = Object.freeze({
  RECEIVE_CONFIRM: MOVEMENT_TYPES.RECEIVE,
  RECEIPT: MOVEMENT_TYPES.RECEIVE,
  RECEIVING: MOVEMENT_TYPES.RECEIVE,
  PUTAWAY_CONFIRM: MOVEMENT_TYPES.PUTAWAY,
  TRANSFER_CONFIRM: MOVEMENT_TYPES.TRANSFER,
  ADJUSTMENT_CONFIRM: MOVEMENT_TYPES.ADJUST_IN,
  ADJUST_IN_CONFIRM: MOVEMENT_TYPES.ADJUST_IN,
  ADJUST_OUT_CONFIRM: MOVEMENT_TYPES.ADJUST_OUT,
  PICK_CONFIRM: MOVEMENT_TYPES.PICK_CONFIRM,
  DISPATCH_CONFIRM: MOVEMENT_TYPES.PICK_CONFIRM,
  WITHDRAWAL: MOVEMENT_TYPES.PICK_CONFIRM,
  DISPATCH: MOVEMENT_TYPES.PICK_CONFIRM,
});

const OUTBOUND_FINAL_RAW_TYPES = new Set([
  'DISPATCH_CONFIRM',
  'DISPATCH',
  'WITHDRAWAL',
]);

export function normalizeMovementType(rawType) {
  if (!rawType) return 'UNSPECIFIED';
  const upper = String(rawType).trim().toUpperCase();
  if (STOCK_TO_CANONICAL[upper]) return STOCK_TO_CANONICAL[upper];
  if (Object.values(MOVEMENT_TYPES).includes(upper)) return upper;
  return upper;
}

export function isDraftMovement(row = {}) {
  const rawType = String(row.movement_type_raw ?? row.movement_type ?? '').toUpperCase();
  const status = String(row.source_document_status ?? row.document_status ?? '').toUpperCase();
  const referenceType = String(row.reference_type ?? '').toUpperCase();

  if (row.is_draft === true) return true;
  if (rawType.includes('DRAFT')) return true;
  if (status === 'DRAFT' || status === 'OPEN') return true;
  if (referenceType.includes('DRAFT')) return true;
  return false;
}

export function resolveBillingEligibility(row = {}) {
  const rawType = String(row.movement_type_raw ?? row.movement_type ?? '').toUpperCase();
  const canonicalType = row.movement_type_canonical
    ?? normalizeMovementType(rawType);

  if (row.is_reversed) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.REVERSED_MOVEMENT,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if (isDraftMovement(row)) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.DRAFT_MOVEMENT,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if (canonicalType === MOVEMENT_TYPES.OPENING_BALANCE) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.OPENING_BALANCE,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if ([MOVEMENT_TYPES.PUTAWAY, MOVEMENT_TYPES.PICK_ALLOCATE].includes(canonicalType)) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.NON_BILLABLE_TYPE,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if ([MOVEMENT_TYPES.ADJUST_IN, MOVEMENT_TYPES.ADJUST_OUT].includes(canonicalType)) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.ADJUSTMENT_DEFAULT_EXCLUDED,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if (canonicalType === MOVEMENT_TYPES.TRANSFER || rawType === 'TRANSFER_CONFIRM') {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.TRANSFER_NOT_CONFIGURED,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if (canonicalType === MOVEMENT_TYPES.REVERSE || rawType.includes('CANCEL')) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.REVERSED_MOVEMENT,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  const hasTraceability = Boolean(
    row.source_document_id
    || row.reference_id
    || row.reference_no
    || row.related_document_id
    || row.source_document_no,
  );

  if (!hasTraceability) {
    return {
      is_billable: false,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.MISSING_TRACEABILITY,
      billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
      canonical_movement_type: canonicalType,
    };
  }

  if (
    canonicalType === MOVEMENT_TYPES.RECEIVE
    || rawType === 'RECEIVE_CONFIRM'
    || rawType === 'RECEIPT'
    || rawType === 'RECEIVING'
  ) {
    return {
      is_billable: true,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.NONE,
      billing_service_type: BILLING_SERVICE_TYPES.INBOUND_HANDLING,
      canonical_movement_type: canonicalType,
    };
  }

  if (canonicalType === MOVEMENT_TYPES.PICK_CONFIRM) {
    if (!OUTBOUND_FINAL_RAW_TYPES.has(rawType)) {
      return {
        is_billable: false,
        billing_exclusion_reason: BILLING_EXCLUSION_REASONS.PICK_NOT_FINAL_DISPATCH,
        billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
        canonical_movement_type: canonicalType,
      };
    }

    return {
      is_billable: true,
      billing_exclusion_reason: BILLING_EXCLUSION_REASONS.NONE,
      billing_service_type: BILLING_SERVICE_TYPES.OUTBOUND_HANDLING,
      canonical_movement_type: canonicalType,
    };
  }

  return {
    is_billable: false,
    billing_exclusion_reason: BILLING_EXCLUSION_REASONS.NON_BILLABLE_TYPE,
    billing_service_type: BILLING_SERVICE_TYPES.NON_BILLABLE,
    canonical_movement_type: canonicalType,
  };
}

export function resolveBillingServiceType(canonicalType, context = {}) {
  return resolveBillingEligibility({
    movement_type_canonical: canonicalType,
    movement_type_raw: context.movement_type_raw ?? canonicalType,
    ...context,
  }).billing_service_type;
}

export function isBillingSourceMovement(row = {}) {
  return resolveBillingEligibility(row).is_billable;
}

export function mapMovementTypeForReport(rawType) {
  return normalizeMovementType(rawType);
}
