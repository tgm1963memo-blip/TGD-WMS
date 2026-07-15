export const WITHDRAWAL_LINE_DEFAULT_COUNT = 5;
export const WITHDRAWAL_QTY_MODES = { WEIGHT: 'WEIGHT', BOXES: 'BOXES' };
export const WITHDRAWAL_IDENTIFIER_TYPES = {
  TRACKING_CODE: 'TRACKING_CODE',
  LOT: 'LOT',
  MFG_DATE: 'MFG_DATE',
  EXP_DATE: 'EXP_DATE',
  NOTE: 'NOTE',
};
export const NULL_LOT_SENTINEL = '__null_lot__';

export function createEmptyWithdrawalLine(lineKey = 1) {
  return {
    key: lineKey,
    catalog_product_id: '',
    customer_product_code: '',
    product_code: '',
    product_name: '',
    identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.LOT,
    identifier_value: '',
    lot_no: '',
    mfg_date: '',
    exp_date: '',
    source_deposit_request_id: '',
    source_deposit_request_line_id: '',
    withdrawal_qty_mode: WITHDRAWAL_QTY_MODES.WEIGHT,
    requested_qty: '',
    requested_boxes: '',
    requested_weight: '',
    picking_rule: 'FEFO',
    argent_type: '',
    temperature_type: 'FROZEN',
    note: '',
  };
}

/** Deposit lines belonging to the line's product (by customer code or product name). */
export function getProductMatchedDepositLines(line, depositLines = []) {
  return (depositLines ?? []).filter((dl) =>
    !line?.customer_product_code ||
    dl.customer_product_code === line.customer_product_code ||
    dl.product_name === line.product_name,
  );
}

/** Product-matched deposit lines further narrowed by the line's chosen identifier (LOT / mfg date / exp date / admin note). */
export function getIdentifierMatchedDepositLines(line, depositLines = []) {
  const productMatched = getProductMatchedDepositLines(line, depositLines);
  const type = line?.identifier_type || WITHDRAWAL_IDENTIFIER_TYPES.LOT;

  if (type === WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE) {
    if (!line?.identifier_value) return productMatched;
    return productMatched.filter((dl) => dl.tracking_code === line.identifier_value);
  }
  if (type === WITHDRAWAL_IDENTIFIER_TYPES.LOT) {
    const isNullLot = line?.lot_no === NULL_LOT_SENTINEL;
    if (isNullLot) return productMatched.filter((dl) => !dl.lot_no);
    if (!line?.lot_no) return productMatched;
    return productMatched.filter((dl) => dl.lot_no === line.lot_no);
  }
  if (type === WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE) {
    if (!line?.identifier_value) return productMatched;
    return productMatched.filter((dl) => dl.mfg_date === line.identifier_value);
  }
  if (type === WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE) {
    if (!line?.identifier_value) return productMatched;
    return productMatched.filter((dl) => dl.exp_date === line.identifier_value);
  }
  if (type === WITHDRAWAL_IDENTIFIER_TYPES.NOTE) {
    if (!line?.identifier_value) return productMatched;
    return productMatched.filter((dl) => dl.actual_note === line.identifier_value);
  }
  return productMatched;
}

function candidateBalance(dl, field) {
  const actualField = field === 'boxes' ? dl.actual_boxes : dl.actual_weight;
  const expectedField = field === 'boxes' ? dl.expected_boxes : dl.expected_weight;
  const a = actualField != null ? Number(actualField) : null;
  if (a != null && Number.isFinite(a)) return a;
  const e = expectedField != null ? Number(expectedField) : null;
  return e != null && Number.isFinite(e) ? e : 0;
}

/**
 * The single best-matching deposit line for the line's chosen identifier,
 * used to resolve weight-per-box, the admin note, and (via
 * getWithdrawalBalanceInfo) the remaining-balance check.
 *
 * A LOT can legitimately span more than one deposit line (several receiving
 * batches/tracking codes under one LOT — see the balance-lock migration's
 * incident notes). When a LOT/date/note identifier matches more than one
 * candidate, blindly taking the first one made two withdrawal rows that
 * reference the same LOT but are actually meant for two DIFFERENT batches
 * collide: sibling-claim netting in getWithdrawalBalanceInfo treated them as
 * competing for a single candidate's balance even though each individually
 * fit a different batch exactly (e.g. one row for 24 boxes matching one
 * untouched batch, another for the 10 boxes remaining on a separate
 * tracking code) — both got wrongly flagged as exceeding the balance.
 *
 * Prefer whichever candidate can actually cover this row's own requested
 * quantity, tie-broken by the smallest sufficient remaining balance (least
 * excess — naturally FEFO-friendly, and deterministic even before a
 * quantity is typed). Falls back to the first candidate only when none of
 * them can individually satisfy the request (matches the previous
 * behavior, so an over-limit request still resolves to *some* line and
 * gets flagged, just not spuriously split across unrelated siblings).
 */
export function getMatchedDepositLine(line, depositLines = []) {
  const candidates = getIdentifierMatchedDepositLines(line, depositLines);
  if (candidates.length <= 1) return candidates[0] ?? null;

  const requestedBoxes = Number(line?.requested_boxes) || 0;
  const requestedWeight = Number(line?.requested_weight) || 0;

  const fits = candidates.filter((dl) =>
    (requestedBoxes <= 0 || candidateBalance(dl, 'boxes') >= requestedBoxes)
    && (requestedWeight <= 0 || candidateBalance(dl, 'weight') >= requestedWeight),
  );

  if (!fits.length) return candidates[0];

  return fits.reduce((best, dl) =>
    (candidateBalance(dl, 'boxes') < candidateBalance(best, 'boxes') ? dl : best),
  );
}

/**
 * Remaining deposit balance for a withdrawal line, and whether the requested
 * quantity exceeds it.
 *
 * Scoped to the single deposit line getMatchedDepositLine() resolves — the
 * exact same one CustomerWithdrawalRequestCreatePage.jsx stamps the
 * withdrawal line's tracking_code/source_customer_deposit_request_line_id
 * from on submit — not pooled across every deposit line sharing the same
 * lot_no. A lot can legitimately span several tracking codes/pallets (a
 * normal situation — see migration 20260708100019's lot-fanout handling),
 * and validating against their combined total here while the withdrawal
 * only ever gets tagged with the one matched code let a request pass with
 * a quantity the pool could cover but that single physical tracking code
 * never held — e.g. requesting 400 boxes against a lot pooling 1,000
 * boxes across three tracking codes, then printing a pick instruction for
 * "400 boxes from tracking code X" when X itself only ever received 100.
 * Withdrawing across multiple tracking codes now requires one line per
 * code (already supported via TRACKING_CODE identifier selection), each
 * validated against its own real balance.
 *
 * `siblingLines` (all other lines in the same draft/request, including the
 * one being checked) is used to also subtract whatever quantity those other
 * lines already claim against the same underlying deposit line — without
 * this, two lines that each individually stay within the balance but
 * jointly exceed it would both pass unflagged (e.g. 60 + 60 against a
 * single 100-box tracking code).
 */
// `actual_*` is the netted remaining balance (see getDepositInventoryLines) —
// 0 is a valid, meaningful value here ("nothing left"), not "unknown". Only
// fall back to expected_* when actual_* itself is missing (null/undefined),
// never on it being falsy-zero — `Number(0) || Number(expected)` would
// silently substitute the pre-withdrawal total and hide a fully-depleted
// balance, letting an over-request through with no client-side warning.
function resolveBalance(actual, expected) {
  const a = actual != null ? Number(actual) : null;
  if (a != null && Number.isFinite(a)) return a;
  const e = expected != null ? Number(expected) : null;
  return e != null && Number.isFinite(e) ? e : 0;
}

export function getWithdrawalBalanceInfo(line, depositLines = [], siblingLines = []) {
  const matchedLine = getMatchedDepositLine(line, depositLines);
  const maxBoxBalance = matchedLine ? resolveBalance(matchedLine.actual_boxes, matchedLine.expected_boxes) : 0;
  const maxWtBalance = matchedLine ? resolveBalance(matchedLine.actual_weight, matchedLine.expected_weight) : 0;

  const otherClaimants = matchedLine
    ? (siblingLines ?? []).filter((other) =>
        other !== line
        && other?.key !== line?.key
        && getMatchedDepositLine(other, depositLines)?.id === matchedLine.id,
      )
    : [];
  const othersClaimedBoxes = otherClaimants.reduce((sum, other) => sum + (Number(other.requested_boxes) || 0), 0);
  const othersClaimedWeight = otherClaimants.reduce((sum, other) => sum + (Number(other.requested_weight) || 0), 0);

  const availableBoxBalance = maxBoxBalance - othersClaimedBoxes;
  const availableWtBalance = maxWtBalance - othersClaimedWeight;
  // matchedLine check (not maxBoxBalance > 0): a genuinely-zero remaining
  // balance must still be flagged when boxes/weight are requested against
  // it — only skip the check when there's no deposit line to compare
  // against at all.
  // WEIGHT_EPSILON absorbs binary-float drift from the subtractions above
  // (e.g. 100.6 - 62.5 === 38.099999999999994, not 38.1) — without it, a
  // user typing the exact balance shown on screen (rounded to 2dp) gets
  // falsely flagged as exceeding it.
  const WEIGHT_EPSILON = 0.005;
  const exceedsBoxBalance = Boolean(matchedLine) && line?.requested_boxes !== '' && Number(line?.requested_boxes) > availableBoxBalance;
  const exceedsWtBalance = Boolean(matchedLine) && line?.requested_weight !== '' && Number(line?.requested_weight) - availableWtBalance > WEIGHT_EPSILON;
  return { maxBoxBalance, maxWtBalance, exceedsBoxBalance, exceedsWtBalance };
}

export function createInitialWithdrawalLines(count = WITHDRAWAL_LINE_DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => createEmptyWithdrawalLine(index + 1));
}

export function isCatalogWithdrawalLineSelected(line) {
  return Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
}

function withdrawalLineHasProduct(line) {
  return isCatalogWithdrawalLineSelected(line) || Boolean(String(line?.product_name ?? '').trim());
}

function withdrawalLineHasQty(line) {
  const mode = line.withdrawal_qty_mode ?? WITHDRAWAL_QTY_MODES.WEIGHT;
  return mode === WITHDRAWAL_QTY_MODES.BOXES
    ? String(line.requested_boxes ?? '').trim() !== ''
    : String(line.requested_weight ?? '').trim() !== '';
}

export function getFilledWithdrawalLines(lines) {
  return (lines ?? []).filter((line) => withdrawalLineHasProduct(line) && withdrawalLineHasQty(line));
}

/**
 * Rows where a product was selected but the requested quantity for the
 * chosen mode (boxes/weight) is still missing. These used to be silently
 * dropped by getFilledWithdrawalLines with no feedback — callers should
 * block submission and surface these row numbers instead.
 */
export function getIncompleteWithdrawalLines(lines) {
  return (lines ?? [])
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => withdrawalLineHasProduct(line) && !withdrawalLineHasQty(line));
}
