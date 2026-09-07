import { describe, expect, it } from 'vitest';
import { parseLocationCode, buildLocationCode } from '../../src/utils/locationCodeUtils.js';

describe('parseLocationCode', () => {
  it('parses a 3-segment room-side-row code', () => {
    expect(parseLocationCode('42-L-01')).toEqual({ room: '42', side: 'L', row: 1 });
  });

  it('uppercases the side and parses a multi-digit row', () => {
    expect(parseLocationCode('H1-r-12')).toEqual({ room: 'H1', side: 'R', row: 12 });
  });

  it('rejects the old 5-segment room-side-row-level-bay format', () => {
    expect(parseLocationCode('42-L-01-01-01')).toBeNull();
  });

  it('rejects the old 4-segment room-side-row-level format', () => {
    expect(parseLocationCode('42-L-01-01')).toBeNull();
  });

  it('returns null for missing or malformed input', () => {
    expect(parseLocationCode(null)).toBeNull();
    expect(parseLocationCode(undefined)).toBeNull();
    expect(parseLocationCode('')).toBeNull();
    expect(parseLocationCode('not-a-code')).toBeNull();
  });
});

describe('buildLocationCode', () => {
  it('builds a code with a zero-padded row', () => {
    expect(buildLocationCode('42', 'L', 1)).toBe('42-L-01');
    expect(buildLocationCode('42', 'L', 12)).toBe('42-L-12');
  });

  it('round-trips through parseLocationCode', () => {
    const code = buildLocationCode('H1', 'R', 7);
    expect(parseLocationCode(code)).toEqual({ room: 'H1', side: 'R', row: 7 });
  });
});
