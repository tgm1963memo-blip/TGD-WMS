import { describe, expect, it } from 'vitest';
import {
  classifyExpiryStatus,
  enrichAgingRows,
  summarizeAgingRows,
} from '../../src/services/storageAgingReportService.js';

// Fixed reference date for deterministic tests: 2026-06-26
const TODAY = new Date('2026-06-26T00:00:00.000Z');

describe('classifyExpiryStatus', () => {
  it('returns NO_EXPIRY_DATE when expiry_date is null', () => {
    expect(classifyExpiryStatus(null, TODAY)).toBe('NO_EXPIRY_DATE');
    expect(classifyExpiryStatus(undefined, TODAY)).toBe('NO_EXPIRY_DATE');
    expect(classifyExpiryStatus('', TODAY)).toBe('NO_EXPIRY_DATE');
  });

  it('returns EXPIRED when expiry_date is before today', () => {
    expect(classifyExpiryStatus('2026-01-01', TODAY)).toBe('EXPIRED');
    expect(classifyExpiryStatus('2025-12-31', TODAY)).toBe('EXPIRED');
    expect(classifyExpiryStatus('2026-06-25', TODAY)).toBe('EXPIRED');
  });

  it('returns NEAR_EXPIRY when expiry_date is within 30 days from today', () => {
    expect(classifyExpiryStatus('2026-06-26', TODAY)).toBe('NEAR_EXPIRY');
    expect(classifyExpiryStatus('2026-07-15', TODAY)).toBe('NEAR_EXPIRY');
    expect(classifyExpiryStatus('2026-07-26', TODAY)).toBe('NEAR_EXPIRY');
  });

  it('returns GOOD when expiry_date is more than 30 days away', () => {
    expect(classifyExpiryStatus('2026-07-27', TODAY)).toBe('GOOD');
    expect(classifyExpiryStatus('2027-01-01', TODAY)).toBe('GOOD');
    expect(classifyExpiryStatus('2030-12-31', TODAY)).toBe('GOOD');
  });
});

describe('enrichAgingRows — remaining_shelf_life_days', () => {
  it('is null when expiry_date is null', () => {
    const [row] = enrichAgingRows([
      { expiry_date: null, created_at: '2026-01-01T00:00:00.000Z' },
    ], { dateAsOf: '2026-06-26' });
    expect(row.remaining_shelf_life_days).toBeNull();
  });

  it('is negative when item is expired (expiry_date in the past)', () => {
    const [row] = enrichAgingRows([
      { expiry_date: '2026-01-01', created_at: '2025-01-01T00:00:00.000Z' },
    ], { dateAsOf: '2026-06-26' });
    expect(row.remaining_shelf_life_days).toBeLessThan(0);
    // 2026-01-01 is 176 days before 2026-06-26
    expect(row.remaining_shelf_life_days).toBe(-176);
  });

  it('is positive when item has future expiry', () => {
    const [row] = enrichAgingRows([
      { expiry_date: '2026-12-31', created_at: '2026-01-01T00:00:00.000Z' },
    ], { dateAsOf: '2026-06-26' });
    expect(row.remaining_shelf_life_days).toBeGreaterThan(0);
    // 2026-12-31 is 188 days after 2026-06-26
    expect(row.remaining_shelf_life_days).toBe(188);
  });

  it('correctly assigns expiry_status from expiry_date', () => {
    const rows = enrichAgingRows([
      { expiry_date: null, created_at: '2026-01-01T00:00:00.000Z' },
      { expiry_date: '2025-12-01', created_at: '2025-01-01T00:00:00.000Z' },
      { expiry_date: '2026-07-10', created_at: '2026-06-01T00:00:00.000Z' },
      { expiry_date: '2027-01-01', created_at: '2026-01-01T00:00:00.000Z' },
    ], { dateAsOf: '2026-06-26' });

    expect(rows[0].expiry_status).toBe('NO_EXPIRY_DATE');
    expect(rows[1].expiry_status).toBe('EXPIRED');
    expect(rows[2].expiry_status).toBe('NEAR_EXPIRY');
    expect(rows[3].expiry_status).toBe('GOOD');
  });

  it('storage age (aging_days) equals days from received date to today', () => {
    const [row] = enrichAgingRows([
      { expiry_date: null, created_at: '2026-01-01T00:00:00.000Z' },
    ], { dateAsOf: '2026-06-26' });
    // 2026-01-01 to 2026-06-26 = 176 days
    expect(row.aging_days).toBe(176);
  });
});

describe('summarizeAgingRows — aggregation', () => {
  const makeRows = (statuses) =>
    statuses.map((expiry_status, i) => ({
      customer_id: `c-${i}`,
      lot_id: `lot-${i}`,
      pallet_id: `pallet-${i}`,
      qty_on_hand: 10,
      aging_days: 30,
      chargeable_days: 30,
      aging_bucket: '0_30',
      expiry_status,
      remaining_shelf_life_days: expiry_status === 'GOOD' ? 90 : (expiry_status === 'NEAR_EXPIRY' ? 15 : null),
    }));

  it('counts expired_lots correctly', () => {
    const rows = makeRows(['EXPIRED', 'EXPIRED', 'GOOD']);
    const summary = summarizeAgingRows(rows);
    expect(summary.expired_lots).toBe(2);
    expect(summary.near_expiry_lots).toBe(0);
    expect(summary.no_expiry_lots).toBe(0);
  });

  it('counts near_expiry_lots correctly', () => {
    const rows = makeRows(['NEAR_EXPIRY', 'GOOD', 'GOOD']);
    const summary = summarizeAgingRows(rows);
    expect(summary.near_expiry_lots).toBe(1);
    expect(summary.expired_lots).toBe(0);
  });

  it('counts no_expiry_lots correctly', () => {
    const rows = makeRows(['NO_EXPIRY_DATE', 'NO_EXPIRY_DATE', 'EXPIRED']);
    const summary = summarizeAgingRows(rows);
    expect(summary.no_expiry_lots).toBe(2);
    expect(summary.expired_lots).toBe(1);
  });

  it('computes average_storage_age from aging_days', () => {
    const rows = [
      { ...makeRows(['GOOD'])[0], aging_days: 10 },
      { ...makeRows(['GOOD'])[0], aging_days: 20, lot_id: 'lot-x', pallet_id: 'p-x', customer_id: 'c-x' },
    ];
    const summary = summarizeAgingRows(rows);
    expect(summary.average_storage_age).toBe(15);
  });

  it('computes average_shelf_life only for rows with expiry date', () => {
    const rows = makeRows(['GOOD', 'NEAR_EXPIRY', 'NO_EXPIRY_DATE', 'EXPIRED']);
    const summary = summarizeAgingRows(rows);
    // Only GOOD (90) and NEAR_EXPIRY (15) have remaining_shelf_life_days
    expect(summary.lots_with_expiry).toBe(2);
    expect(summary.average_shelf_life).toBe(Math.round((90 + 15) / 2));
  });

  it('summary reflects Single Source of Truth — same dataset as table', () => {
    const allRows = makeRows(['EXPIRED', 'NEAR_EXPIRY', 'NO_EXPIRY_DATE', 'GOOD']);
    const summary = summarizeAgingRows(allRows);

    // Manually count from the same rows
    const manualExpired = allRows.filter(r => r.expiry_status === 'EXPIRED').length;
    const manualNear = allRows.filter(r => r.expiry_status === 'NEAR_EXPIRY').length;
    const manualNoExpiry = allRows.filter(r => r.expiry_status === 'NO_EXPIRY_DATE').length;

    expect(summary.expired_lots).toBe(manualExpired);
    expect(summary.near_expiry_lots).toBe(manualNear);
    expect(summary.no_expiry_lots).toBe(manualNoExpiry);
  });
});
