import { PACK_ENTRY_MODES } from './customerDepositPackCalcUtils.js';

export const DEPOSIT_LINE_DEFAULT_COUNT = 5;

export function createEmptyDepositLine(lineKey = 1) {
  return {
    key: lineKey,
    catalog_product_id: '',
    customer_product_code: '',
    product_code: '',
    product_name: '',
    weight_per_box: '',
    expected_boxes: '',
    expected_weight: '',
    pack_entry_mode: PACK_ENTRY_MODES.BOXES,
    line_note: '',
    temperature_type: 'FROZEN',
    lot_no: '',
    mfg_date: '',
    exp_date: '',
  };
}

export function createInitialDepositLines(count = DEPOSIT_LINE_DEFAULT_COUNT) {
  return Array.from({ length: count }, (_, index) => createEmptyDepositLine(index + 1));
}

export function isCatalogDepositLineSelected(line) {
  return Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
}

export function getFilledDepositLines(lines) {
  return (lines ?? []).filter((line) => {
    if (!isCatalogDepositLineSelected(line)) return false;
    const weightPerBox = Number(line.weight_per_box);
    const totalWeight = Number(line.expected_weight);
    const boxes = Number(line.expected_boxes);
    return weightPerBox > 0 && totalWeight > 0 && boxes > 0;
  });
}
