export const PACK_ENTRY_MODES = Object.freeze({
  BOXES: 'BOXES',
  WEIGHT: 'WEIGHT',
});

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Without a per-unit weight there's nothing to derive the other field from —
// total weight and box count must be entered independently in that case.
export function hasUnitWeight(weightPerBox) {
  return toPositiveNumber(weightPerBox) != null;
}

export function formatPackNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

export function calcTotalWeightFromBoxes(boxes, weightPerBox) {
  const boxCount = toPositiveNumber(boxes);
  const unitWeight = toPositiveNumber(weightPerBox);
  if (!boxCount || !unitWeight) return '';
  return formatPackNumber(boxCount * unitWeight);
}

export function calcBoxesFromTotalWeight(totalWeight, weightPerBox) {
  const total = toPositiveNumber(totalWeight);
  const unitWeight = toPositiveNumber(weightPerBox);
  if (!total || !unitWeight) return '';
  return formatPackNumber(Math.max(1, Math.round(total / unitWeight)));
}

// BOXES is always available as the native unit (backed by whatever
// weightPerBox the line already has); a product's own tgd_customer_product_
// units rows (product.units, see customerProductCatalogService.js's embed)
// are appended after it. A product with no defined units returns just the
// single BOXES entry, so callers degrade to today's plain box/weight
// behavior automatically.
export function buildEntryUnitOptions(product, weightPerBox) {
  const boxesUnit = {
    unit_code: 'BOXES',
    unit_label: 'กล่อง',
    weight_per_unit_kg: toPositiveNumber(weightPerBox),
    boxes_per_unit: 1,
  };
  return [boxesUnit, ...(product?.units ?? [])];
}

// Converts a count entered in the given unit down to {boxes, weight},
// reusing calcTotalWeightFromBoxes/calcBoxesFromTotalWeight (the same
// tested BOXES<->WEIGHT math already used everywhere) instead of a new
// arithmetic path:
// - unit.boxes_per_unit set (e.g. "1 ลัง = 10 กล่อง"): multiply for an
//   exact box count first, then derive weight from boxes as usual.
// - unit.boxes_per_unit absent (e.g. "1 แพ็ค = 500 กรัม"): sum the weight
//   first, then derive boxes from weight as usual (same rounding as the
//   existing WEIGHT entry mode).
export function convertUnitQtyToBoxesAndWeight(unitQty, unit, weightPerBox) {
  const qty = toPositiveNumber(unitQty);
  if (!qty || !unit) return { boxes: '', weight: '' };

  if (unit.unit_code === 'BOXES') {
    return { boxes: formatPackNumber(qty), weight: calcTotalWeightFromBoxes(qty, weightPerBox) };
  }

  const boxesPerUnit = toPositiveNumber(unit.boxes_per_unit);
  if (boxesPerUnit) {
    const boxes = qty * boxesPerUnit;
    return { boxes: formatPackNumber(boxes), weight: calcTotalWeightFromBoxes(boxes, weightPerBox) };
  }

  const weightPerUnitKg = toPositiveNumber(unit.weight_per_unit_kg);
  if (!weightPerUnitKg) return { boxes: '', weight: '' };
  const totalWeight = qty * weightPerUnitKg;
  return { boxes: calcBoxesFromTotalWeight(totalWeight, weightPerBox), weight: formatPackNumber(totalWeight) };
}

// Whether convertUnitQtyToBoxesAndWeight can actually produce a boxes/
// weight value for the given unit + weightPerBox — a boxes_per_unit-based
// unit (e.g. CASE) always yields boxes but needs weightPerBox to derive
// weight; a weight-only unit (e.g. PACK) always yields weight but needs
// weightPerBox to derive boxes. Callers use these to decide whether it's
// safe to disable a field as "fully derived" vs. leave it open for manual
// entry (mirrors hasUnitWeight's existing role for the plain BOXES/WEIGHT
// toggle).
export function canDeriveUnitBoxes(unit, weightPerBox) {
  if (!unit || unit.unit_code === 'BOXES') return hasUnitWeight(weightPerBox);
  return toPositiveNumber(unit.boxes_per_unit) != null || hasUnitWeight(weightPerBox);
}

export function canDeriveUnitWeight(unit, weightPerBox) {
  if (!unit || unit.unit_code === 'BOXES') return hasUnitWeight(weightPerBox);
  return toPositiveNumber(unit.boxes_per_unit) == null || hasUnitWeight(weightPerBox);
}

// True when converting unitQty via boxes_per_unit would produce a
// non-whole box count (e.g. 3 ลัง at 7.5 boxes/ลัง = 22.5 boxes) -- callers
// should surface this as a warning rather than silently rounding, since
// (unlike weight-derived box counts) a boxes_per_unit ratio is meant to be
// exact.
export function unitQtyRoundsToFractionalBoxes(unitQty, unit) {
  const qty = toPositiveNumber(unitQty);
  const boxesPerUnit = toPositiveNumber(unit?.boxes_per_unit);
  if (!qty || !boxesPerUnit) return false;
  const boxes = qty * boxesPerUnit;
  return Math.abs(boxes - Math.round(boxes)) > 1e-9;
}

export function applyPackFieldChange({ mode, field, value, weightPerBox, expectedBoxes, expectedWeight }) {
  const next = {
    weight_per_box: weightPerBox,
    expected_boxes: expectedBoxes,
    expected_weight: expectedWeight,
  };

  if (field === 'weight_per_box') {
    next.weight_per_box = value;
    if (mode === PACK_ENTRY_MODES.BOXES && next.expected_boxes) {
      next.expected_weight = calcTotalWeightFromBoxes(next.expected_boxes, value);
    } else if (mode === PACK_ENTRY_MODES.WEIGHT && next.expected_weight) {
      next.expected_boxes = calcBoxesFromTotalWeight(next.expected_weight, value);
    }
    return next;
  }

  if (field === 'expected_boxes') {
    next.expected_boxes = value;
    if (mode === PACK_ENTRY_MODES.BOXES && hasUnitWeight(next.weight_per_box)) {
      next.expected_weight = calcTotalWeightFromBoxes(value, next.weight_per_box);
    }
    return next;
  }

  if (field === 'expected_weight') {
    next.expected_weight = value;
    if (mode === PACK_ENTRY_MODES.WEIGHT && hasUnitWeight(next.weight_per_box)) {
      next.expected_boxes = calcBoxesFromTotalWeight(value, next.weight_per_box);
    }
    return next;
  }

  return next;
}
