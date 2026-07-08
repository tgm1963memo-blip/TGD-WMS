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

/** The single best-matching deposit line for the line's chosen identifier, used to resolve weight-per-box and the admin note. */
export function getMatchedDepositLine(line, depositLines = []) {
  return getIdentifierMatchedDepositLines(line, depositLines)[0] ?? null;
}

/**
 * Remaining deposit balance for a withdrawal line, and whether the requested
 * quantity exceeds it.
 *
 * `siblingLines` (all other lines in the same draft/request, including the
 * one being checked) is used to also subtract whatever quantity those other
 * lines already claim against the same underlying deposit line(s) — without
 * this, two lines that each individually stay within the total balance but
 * jointly exceed it would both pass unflagged. This is exactly the shape of
 * a real incident: two lines in one withdrawal request both drawing from
 * the same 100-box tracking code (there they each independently over-asked
 * for 200, which the single-line check already caught, but a pair of
 * requests each under the total — e.g. 60 + 60 against 100 — would not have
 * been).
 */
export function getWithdrawalBalanceInfo(line, depositLines = [], siblingLines = []) {
  const balanceLines = getIdentifierMatchedDepositLines(line, depositLines);
  const balanceLineIds = new Set(balanceLines.map((dl) => dl.id));
  const maxBoxBalance = balanceLines.reduce((sum, dl) => sum + (Number(dl.actual_boxes) || Number(dl.expected_boxes) || 0), 0);
  const maxWtBalance = balanceLines.reduce((sum, dl) => sum + (Number(dl.actual_weight) || Number(dl.expected_weight) || 0), 0);

  const otherClaimants = (siblingLines ?? []).filter((other) =>
    other !== line
    && other?.key !== line?.key
    && getIdentifierMatchedDepositLines(other, depositLines).some((dl) => balanceLineIds.has(dl.id)),
  );
  const othersClaimedBoxes = otherClaimants.reduce((sum, other) => sum + (Number(other.requested_boxes) || 0), 0);
  const othersClaimedWeight = otherClaimants.reduce((sum, other) => sum + (Number(other.requested_weight) || 0), 0);

  const availableBoxBalance = maxBoxBalance - othersClaimedBoxes;
  const availableWtBalance = maxWtBalance - othersClaimedWeight;
  const exceedsBoxBalance = maxBoxBalance > 0 && line?.requested_boxes !== '' && Number(line?.requested_boxes) > availableBoxBalance;
  const exceedsWtBalance = maxWtBalance > 0 && line?.requested_weight !== '' && Number(line?.requested_weight) > availableWtBalance;
  return { maxBoxBalance, maxWtBalance, exceedsBoxBalance, exceedsWtBalance };
}

export function createInitialWithdrawalLines(count = WITHDRAWAL_LINE_DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => createEmptyWithdrawalLine(index + 1));
}

export function isCatalogWithdrawalLineSelected(line) {
  return Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
}

export function getFilledWithdrawalLines(lines) {
  return (lines ?? []).filter(
    (line) => {
      const hasProduct = isCatalogWithdrawalLineSelected(line) || Boolean(String(line?.product_name ?? '').trim());
      const mode = line.withdrawal_qty_mode ?? WITHDRAWAL_QTY_MODES.WEIGHT;
      const hasQty = mode === WITHDRAWAL_QTY_MODES.BOXES
        ? String(line.requested_boxes ?? '').trim() !== ''
        : String(line.requested_weight ?? '').trim() !== '';
      return hasProduct && hasQty;
    },
  );
}
