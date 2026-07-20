import { describe, expect, it } from 'vitest';
import { formatFixed2, round2 } from '../../src/utils/numberFormat.js';

describe('numberFormat', () => {
  it('round2 fixes float drift to 2 decimal places', () => {
    expect(round2(12.339999999999998)).toBe(12.34);
    expect(round2(10)).toBe(10);
    expect(round2('12.345')).toBe(12.35);
    expect(round2(null)).toBe(0);
    expect(round2('not-a-number')).toBe(0);
  });

  it('formatFixed2 always shows exactly 2 decimals', () => {
    expect(formatFixed2(12.339999999999998)).toBe('12.34');
    expect(formatFixed2(10)).toBe('10.00');
    expect(formatFixed2(12.3)).toBe('12.30');
  });

  it('formatFixed2 falls back to the empty display for null/blank/non-numeric', () => {
    expect(formatFixed2(null)).toBe('-');
    expect(formatFixed2('')).toBe('-');
    expect(formatFixed2('abc')).toBe('-');
    expect(formatFixed2(undefined, { emptyDisplay: '0' })).toBe('0');
  });
});
