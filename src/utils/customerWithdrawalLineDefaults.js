export const WITHDRAWAL_LINE_DEFAULT_COUNT = 5;
export const WITHDRAWAL_QTY_MODES = { WEIGHT: 'WEIGHT', BOXES: 'BOXES' };
export const WITHDRAWAL_IDENTIFIER_TYPES = {
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
