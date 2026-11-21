import { describe, expect, it } from 'vitest';
import { PHYSICAL_RECEIPT_ANCHOR_FROM, resolveStorageReceiptDate } from '../../src/utils/billingRateCalc.js';

describe('resolveStorageReceiptDate (Nov 2026+ physical receipt anchor)', () => {
  it('cutoff is 1 Nov 2026', () => {
    expect(PHYSICAL_RECEIPT_ANCHOR_FROM).toBe('2026-11-01');
  });

  it('anchors a November deposit to the physical receipt day, not the admin confirm day (CDR-20261114-0002)', () => {
    expect(resolveStorageReceiptDate('2026-11-16', {
      receivingStartedAt: '2026-11-14T08:30:00+00:00',
      receivingFinishedAt: '2026-11-14T08:49:00+00:00',
    })).toBe('2026-11-14');
  });

  it('uses the Bangkok calendar day of the receiving time', () => {
    // 23:30 UTC on the 2nd = 06:30 on the 3rd in Bangkok
    expect(resolveStorageReceiptDate('2026-11-05', { receivingStartedAt: '2026-11-02T23:30:00+00:00' })).toBe('2026-11-03');
  });

  it('falls back to receiving_finished_at when start time is missing', () => {
    expect(resolveStorageReceiptDate('2026-11-10', { receivingFinishedAt: '2026-11-08T05:00:00+00:00' })).toBe('2026-11-08');
  });

  it('keeps the confirmed date for deposits physically received before November (already-billed months)', () => {
    expect(resolveStorageReceiptDate('2026-11-02', { receivingStartedAt: '2026-10-31T03:00:00+00:00' })).toBe('2026-11-02');
    expect(resolveStorageReceiptDate('2026-10-22', { receivingStartedAt: '2026-10-16T03:00:00+00:00' })).toBe('2026-10-22');
  });

  it('keeps the confirmed date when there is no receiving time (old/opening-balance documents)', () => {
    expect(resolveStorageReceiptDate('2026-06-30', {})).toBe('2026-06-30');
    expect(resolveStorageReceiptDate(null, {})).toBeNull();
  });

  it('ignores a physical date later than the confirmation (bad data)', () => {
    expect(resolveStorageReceiptDate('2026-11-03', { receivingStartedAt: '2026-11-09T03:00:00+00:00' })).toBe('2026-11-03');
  });

  it('uses the physical date when no confirmed date resolved', () => {
    expect(resolveStorageReceiptDate(null, { receivingStartedAt: '2026-11-14T08:30:00+00:00' })).toBe('2026-11-14');
  });
});
