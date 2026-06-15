import { describe, it, expect } from 'vitest';
import {
  formatDocumentDate,
  isDateColumnKey,
  isMetaColumnKey,
  shouldUseDateOnlyFormat,
} from '../../src/utils/documentDisplayUtils.js';

describe('documentDisplayUtils', () => {
  it('formats datetime values for Thai locale display', () => {
    const formatted = formatDocumentDate('2026-06-08T10:30:00.000Z');
    expect(formatted).not.toBe('-');
    expect(formatted).not.toBe('2026-06-08T10:30:00.000Z');
  });

  it('formats date-only values without time', () => {
    const formatted = formatDocumentDate('2026-06-08', { dateOnly: true });
    expect(formatted).not.toBe('-');
    expect(formatted).not.toContain(':');
  });

  it('detects date and meta column keys', () => {
    expect(isDateColumnKey('created_at')).toBe(true);
    expect(isDateColumnKey('dispatch_date')).toBe(true);
    expect(shouldUseDateOnlyFormat('dispatch_date')).toBe(true);
    expect(shouldUseDateOnlyFormat('created_at')).toBe(false);
    expect(isMetaColumnKey('warehouse_id')).toBe(true);
    expect(isMetaColumnKey('transfer_type')).toBe(true);
    expect(isMetaColumnKey('transfer_no')).toBe(false);
  });
});
