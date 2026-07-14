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
  const hasCatalogId = Boolean(line?.catalog_product_id && line.catalog_product_id !== '__manual__');
  const hasProductCode = Boolean(line?.customer_product_code?.trim());
  return hasCatalogId || hasProductCode;
}

function isDepositLineComplete(line) {
  // weight_per_box is optional: when the customer doesn't know the per-unit
  // weight, total weight and box count are captured independently instead.
  const totalWeight = Number(line.expected_weight);
  const boxes = Number(line.expected_boxes);
  return totalWeight > 0 && boxes > 0;
}

export function getFilledDepositLines(lines) {
  return (lines ?? []).filter((line) => isCatalogDepositLineSelected(line) && isDepositLineComplete(line));
}

/**
 * Rows where a product was selected but the required quantity fields
 * (box count / total weight) are still missing. These used to be silently
 * dropped by getFilledDepositLines with no feedback — callers should block
 * submission and surface these row numbers instead.
 */
export function getIncompleteDepositLines(lines) {
  return (lines ?? [])
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isCatalogDepositLineSelected(line) && !isDepositLineComplete(line));
}
