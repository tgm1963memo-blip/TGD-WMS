import { describe, expect, it } from 'vitest';
import { insertSoftBreaks } from '../../src/utils/textWrapUtils.js';

describe('insertSoftBreaks', () => {
  it('leaves short text untouched', () => {
    expect(insertSoftBreaks('ABC', 8)).toBe('ABC');
  });

  it('returns null/undefined as-is', () => {
    expect(insertSoftBreaks(null, 8)).toBe(null);
    expect(insertSoftBreaks(undefined, 8)).toBe(undefined);
  });

  it('inserts zero-width-space break points for long text without altering visible content', () => {
    const input = 'คอทเทจเบค่อน1000กรัมTSS(พิเศษว่าวเถาแดง)';
    const result = insertSoftBreaks(input, 8);
    expect(result).not.toBe(input);
    expect(result.includes('​')).toBe(true);
    expect(result.replace(/​/g, '')).toBe(input);
  });

  it('never splits a base character from its combining Thai vowel/tone mark', () => {
    // เ-ีย-่ contains combining marks that must stay attached to their base
    const input = 'ไก่ย่างเนื้อทอดสามชั้นหมูปิ้งข้าวเหนียวส้มตำ';
    const result = insertSoftBreaks(input, 4);
    const segments = result.split('​');
    for (const segment of segments) {
      // A segment must not start with a combining mark orphaned from its base
      expect(/^[ัิ-ฺ็-๎]/.test(segment)).toBe(false);
    }
    expect(result.replace(/​/g, '')).toBe(input);
  });
});
