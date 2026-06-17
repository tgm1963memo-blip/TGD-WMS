export const DEPOSIT_LINE_DEFAULT_COUNT = 10;

export function createEmptyDepositLine(lineKey = 1) {
  return {
    key: lineKey,
    catalog_product_id: '',
    customer_product_code: '',
    product_code: '',
    product_name: '',
    lot_no: '',
    mfg_date: '',
    exp_date: '',
    argent_type: '',
    expected_qty: '',
    expected_boxes: '',
    expected_weight: '',
    temperature_type: 'FROZEN',
  };
}

export function createInitialDepositLines(count = DEPOSIT_LINE_DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => createEmptyDepositLine(index + 1));
}

export function isCatalogDepositLineSelected(line) {
  return Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
}

export function getFilledDepositLines(lines) {
  return (lines ?? []).filter(
    (line) => isCatalogDepositLineSelected(line) && String(line.expected_qty ?? '').trim() !== '',
  );
}
