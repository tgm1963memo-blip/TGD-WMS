export const PACK_ENTRY_MODES = Object.freeze({
  BOXES: 'BOXES',
  WEIGHT: 'WEIGHT',
});

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
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
    if (mode === PACK_ENTRY_MODES.BOXES) {
      next.expected_weight = calcTotalWeightFromBoxes(value, next.weight_per_box);
    }
    return next;
  }

  if (field === 'expected_weight') {
    next.expected_weight = value;
    if (mode === PACK_ENTRY_MODES.WEIGHT) {
      next.expected_boxes = calcBoxesFromTotalWeight(value, next.weight_per_box);
    }
    return next;
  }

  return next;
}
