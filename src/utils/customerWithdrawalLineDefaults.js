export const WITHDRAWAL_LINE_DEFAULT_COUNT = 5;

export function createEmptyWithdrawalLine(lineKey = 1) {
  return {
    key: lineKey,
    catalog_product_id: '',
    customer_product_code: '',
    product_code: '',
    product_name: '',
    identifier_type: 'LOT',
    lot_no: '',
    mfg_date: '',
    exp_date: '',
    source_deposit_request_id: '',
    requested_qty: '',
    requested_boxes: '',
    requested_weight: '',
    picking_rule: 'FEFO',
    argent_type: '',
    temperature_type: 'FROZEN',
  };
}

export function createInitialWithdrawalLines(count = WITHDRAWAL_LINE_DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => createEmptyWithdrawalLine(index + 1));
}

export function isCatalogWithdrawalLineSelected(line) {
  return Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
}

export function getFilledWithdrawalLines(lines) {
  return (lines ?? []).filter(
    (line) => isCatalogWithdrawalLineSelected(line) && String(line.requested_weight ?? '').trim() !== '',
  );
}
