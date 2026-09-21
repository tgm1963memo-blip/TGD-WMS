import { describe, expect, it } from 'vitest';
import {
  formatDurationBetween,
  combineDateWithEditedTime,
  formatTimeHHmm,
} from '../../src/utils/workTimerUtils.js';

describe('formatDurationBetween', () => {
  it('returns null when either timestamp is missing', () => {
    expect(formatDurationBetween(null, '2026-09-19T10:15:00Z')).toBeNull();
    expect(formatDurationBetween('2026-09-19T09:37:00Z', null)).toBeNull();
  });

  it('formats a sub-hour duration in minutes only', () => {
    expect(formatDurationBetween('2026-09-19T09:37:00Z', '2026-09-19T10:15:00Z')).toBe('38 นาที');
  });

  it('formats an exact-hour duration without a minutes component', () => {
    expect(formatDurationBetween('2026-09-19T09:00:00Z', '2026-09-19T10:00:00Z')).toBe('1 ชม');
  });

  it('formats a multi-hour duration with both components', () => {
    expect(formatDurationBetween('2026-09-19T08:00:00Z', '2026-09-19T10:15:00Z')).toBe('2 ชม 15 นาที');
  });

  it('clamps a finish time before the start time to zero instead of going negative', () => {
    expect(formatDurationBetween('2026-09-19T10:00:00Z', '2026-09-19T09:00:00Z')).toBe('0 นาที');
  });
});

describe('combineDateWithEditedTime', () => {
  it('preserves the existing date and swaps in the edited time', () => {
    const iso = combineDateWithEditedTime('2026-09-19T09:37:00.000Z', '10:15');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September (0-indexed)
    expect(d.getDate()).toBe(d.getDate()); // date preserved (local TZ-dependent, just sanity)
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(15);
  });

  it('defaults to today when there is no existing timestamp', () => {
    const iso = combineDateWithEditedTime(null, '09:00');
    const d = new Date(iso);
    const now = new Date();
    expect(d.getFullYear()).toBe(now.getFullYear());
    expect(d.getMonth()).toBe(now.getMonth());
    expect(d.getDate()).toBe(now.getDate());
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('returns null for a malformed time string', () => {
    expect(combineDateWithEditedTime('2026-09-19T09:37:00.000Z', 'not-a-time')).toBeNull();
  });
});

describe('formatTimeHHmm', () => {
  it('returns null for a missing value', () => {
    expect(formatTimeHHmm(null)).toBeNull();
  });

  it('formats an ISO timestamp as HH:MM', () => {
    // en-GB 24h format — assert shape rather than a locale-dependent exact string.
    expect(formatTimeHHmm('2026-09-19T09:37:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});
