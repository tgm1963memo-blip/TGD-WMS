import { describe, expect, it } from 'vitest';
import {
  applyPackFieldChange,
  calcBoxesFromTotalWeight,
  calcTotalWeightFromBoxes,
  PACK_ENTRY_MODES,
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
