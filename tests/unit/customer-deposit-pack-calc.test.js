import { describe, expect, it } from 'vitest';
import {
  applyPackFieldChange,
  buildEntryUnitOptions,
  calcBoxesFromTotalWeight,
  calcTotalWeightFromBoxes,
  canDeriveUnitBoxes,
  canDeriveUnitWeight,
  convertUnitQtyToBoxesAndWeight,
  PACK_ENTRY_MODES,
  unitQtyRoundsToFractionalBoxes,
} from '../../src/utils/customerDepositPackCalcUtils.js';

describe('customerDepositPackCalcUtils', () => {
  it('calculates total weight from boxes', () => {
    expect(calcTotalWeightFromBoxes('5', '10')).toBe('50');
  });

  it('calculates box count from total weight', () => {
    expect(calcBoxesFromTotalWeight('100', '10')).toBe('10');
  });

  it('updates total weight when entering boxes in box mode', () => {
    const result = applyPackFieldChange({
      mode: PACK_ENTRY_MODES.BOXES,
      field: 'expected_boxes',
      value: '4',
      weightPerBox: '12.5',
      expectedBoxes: '',
      expectedWeight: '',
    });
    expect(result.expected_boxes).toBe('4');
    expect(result.expected_weight).toBe('50');
  });

  it('updates box count when entering total weight in weight mode', () => {
    const result = applyPackFieldChange({
      mode: PACK_ENTRY_MODES.WEIGHT,
      field: 'expected_weight',
      value: '90',
      weightPerBox: '10',
      expectedBoxes: '',
      expectedWeight: '',
    });
    expect(result.expected_weight).toBe('90');
    expect(result.expected_boxes).toBe('9');
  });
});

describe('buildEntryUnitOptions', () => {
  it('returns only BOXES when the product defines no units (backward compatible)', () => {
    const options = buildEntryUnitOptions(null, '10');
    expect(options).toHaveLength(1);
    expect(options[0].unit_code).toBe('BOXES');
  });

  it('appends the product\'s own units after BOXES', () => {
    const product = { units: [{ unit_code: 'CASE', unit_label: 'ลัง', boxes_per_unit: 10, weight_per_unit_kg: 5 }] };
    const options = buildEntryUnitOptions(product, '10');
    expect(options.map((u) => u.unit_code)).toEqual(['BOXES', 'CASE']);
  });
});

describe('convertUnitQtyToBoxesAndWeight', () => {
  const weightPerBox = '10';

  it('BOXES unit behaves exactly like the existing box->weight calculation', () => {
    const unit = { unit_code: 'BOXES' };
    const result = convertUnitQtyToBoxesAndWeight('5', unit, weightPerBox);
    expect(result.boxes).toBe('5');
    expect(result.weight).toBe('50');
  });

  it('a boxes_per_unit-defined unit (e.g. ลัง = 10 กล่อง) multiplies exactly, no rounding', () => {
    const unit = { unit_code: 'CASE', boxes_per_unit: 10 };
    const result = convertUnitQtyToBoxesAndWeight('3', unit, weightPerBox);
    expect(result.boxes).toBe('30');
    expect(result.weight).toBe('300');
  });

  it('a weight-only unit (e.g. แพ็ค = 0.5 กก.) sums weight then derives boxes the same way WEIGHT mode does', () => {
    const unit = { unit_code: 'PACK', weight_per_unit_kg: 0.5 };
    const result = convertUnitQtyToBoxesAndWeight('20', unit, weightPerBox);
    expect(result.weight).toBe('10');
    expect(result.boxes).toBe('1');
  });

  it('returns empty values when qty is missing or unit is unusable', () => {
    expect(convertUnitQtyToBoxesAndWeight('', { unit_code: 'CASE', boxes_per_unit: 10 }, weightPerBox)).toEqual({ boxes: '', weight: '' });
    expect(convertUnitQtyToBoxesAndWeight('3', { unit_code: 'PACK' }, weightPerBox)).toEqual({ boxes: '', weight: '' });
  });
});

describe('unitQtyRoundsToFractionalBoxes', () => {
  it('flags a non-whole box count from a boxes_per_unit ratio', () => {
    const unit = { boxes_per_unit: 7.5 };
    expect(unitQtyRoundsToFractionalBoxes('3', unit)).toBe(true);
  });

  it('does not flag a whole box count', () => {
    const unit = { boxes_per_unit: 10 };
    expect(unitQtyRoundsToFractionalBoxes('3', unit)).toBe(false);
  });

  it('does not flag a weight-only unit (no boxes_per_unit at all)', () => {
    const unit = { weight_per_unit_kg: 0.5 };
    expect(unitQtyRoundsToFractionalBoxes('3', unit)).toBe(false);
  });
});

describe('canDeriveUnitBoxes / canDeriveUnitWeight', () => {
  it('a boxes_per_unit-based unit (CASE) always derives boxes, but weight only when weightPerBox is known', () => {
    const unit = { unit_code: 'CASE', boxes_per_unit: 10 };
    expect(canDeriveUnitBoxes(unit, '')).toBe(true);
    expect(canDeriveUnitBoxes(unit, '10')).toBe(true);
    expect(canDeriveUnitWeight(unit, '')).toBe(false);
    expect(canDeriveUnitWeight(unit, '10')).toBe(true);
  });

  it('a weight-only unit (PACK) always derives weight, but boxes only when weightPerBox is known', () => {
    const unit = { unit_code: 'PACK', weight_per_unit_kg: 0.5 };
    expect(canDeriveUnitWeight(unit, '')).toBe(true);
    expect(canDeriveUnitWeight(unit, '10')).toBe(true);
    expect(canDeriveUnitBoxes(unit, '')).toBe(false);
    expect(canDeriveUnitBoxes(unit, '10')).toBe(true);
  });
});
