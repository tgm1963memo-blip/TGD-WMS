import { describe, expect, it } from 'vitest';
import {
  computeStorageInvoiceLines, computeAuxiliaryServiceLines, resolveServiceRate, generateLotBillingCycles,
} from '../../src/utils/billingRateCalc.js';

const STORAGE_RATE_30D = {
  id: 'rate-1', service_type: 'STORAGE', unit_basis: 'PER_KG',
  rate: 5, period_days: 30, is_active: true, customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
};

describe('computeStorageInvoiceLines', () => {
  it('bills a cycle in full the moment it begins, even with only a few days elapsed so far ("เต็มรอบทันที")', () => {
    // Confirmed business rule: goods held only 10 of a 30-day cycle's days
    // (the cycle hasn't completed) still bill the FULL cycle rate — no
    // day-fraction discount for a cycle still in progress.
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-10', // only 10 of 30 days in
    });
    expect(line.weight).toBe(1000);
    expect(line.amount).toBe(1000 * 5); // full cycle rate, not (10/30) of it
    expect(line.periodStart).toBe('2026-01-01');
    expect(line.periodEnd).toBe('2026-01-30');
  });

  it('bills each cycle that has genuinely begun within the window as its own line — a 31-day window against a 30-day rate crosses into a real 2nd cycle, one day in', () => {
    // This looks like the old ceil(days_in_window/period_days) bug this
    // replaced, but it isn't: that model derived the period count from the
    // ARBITRARY window's length alone. This one walks the lot's own fixed
    // cycle grid (anchored to receipt_date) and only counts a cycle once
    // that grid genuinely reaches it — here cycle 2 truly starts on day 31
    // and the window includes that day, so per "เต็มรอบทันที" it's billed.
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ periodStart: '2026-01-01', periodEnd: '2026-01-30', weight: 1000, amount: 5000 });
    expect(lines[1]).toMatchObject({ periodStart: '2026-01-31', periodEnd: '2026-03-01', weight: 1000, amount: 5000 });
  });

  it('a mid-cycle withdrawal does not discount the cycle already in progress, but does reduce the next one', () => {
    // Deposit 1000kg on Jan 1 (30-day cycle: Jan 1-30), withdraw 600kg on
    // Jan 16 (still inside cycle 1) — cycle 1 is charged at the FULL 1000kg
    // it held when the cycle began; cycle 2 (starts Jan 31) reflects the
    // withdrawal and is charged at the reduced 400kg.
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01',
        withdrawal_events: [{ weight: 600, date: '2026-01-16' }],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ periodStart: '2026-01-01', periodEnd: '2026-01-30', weight: 1000, amount: 5000 });
    expect(lines[1]).toMatchObject({ periodStart: '2026-01-31', periodEnd: '2026-03-01', weight: 400, amount: 2000 });
  });

  it('produces zero/no line once the full weight has been withdrawn before the period', () => {
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01',
        withdrawal_events: [{ weight: 1000, date: '2026-01-05' }],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-02-01', periodEnd: '2026-02-28',
    });
    expect(lines).toHaveLength(0);
  });

  it('bills a one-time (period_days null) fee on full received weight, unaffected by later withdrawals', () => {
    const oneTimeRate = { ...STORAGE_RATE_30D, id: 'rate-2', period_days: null, rate: 2 };
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-05',
        withdrawal_events: [{ weight: 900, date: '2026-01-06' }],
      }],
      rates: [oneTimeRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(line.amount).toBeCloseTo(1000 * 2, 2);
  });

  it('rounds each computed line amount to 2 decimal places', () => {
    const oddRate = { ...STORAGE_RATE_30D, rate: 3.333 };
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 777, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [oddRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-10',
    });
    // 777 * 3.333 = 2589.741, rounded to 2589.74 — asserting against the
    // exact expected value (not a *100-then-isInteger check) since that
    // check is itself floating-point-fragile for some otherwise-correctly-
    // rounded values (e.g. 2589.74 * 100 !== 258974 in IEEE 754).
    expect(line.amount).toBeCloseTo(2589.74, 2);
  });
});

describe('computeAuxiliaryServiceLines', () => {
  it('caps quantity at max_quantity and rounds the amount', () => {
    const [line] = computeAuxiliaryServiceLines({
      selections: [{
        depositRequestId: 'req-1', customerId: 'cust-1',
        rate: { rate: 3.333, max_quantity: 5 },
        quantity: 12,
      }],
    });
    expect(line.quantity).toBe(5);
    expect(line.amount).toBe(16.67);
  });
});

describe('generateLotBillingCycles', () => {
  it('generates consecutive full periodDays cycles anchored to the lot\'s own receipt date', () => {
    // First-ever run: seed the day before receipt so cycle 1 starts fresh.
    const cycles = generateLotBillingCycles({
      receiptDate: '2026-01-30',
      periodDays: 15,
      billedThroughDate: '2026-01-29',
      billThroughDate: '2026-03-15', // receiptDate + 44 days = exactly 3 full cycles
    });
    expect(cycles).toEqual([
      { start: '2026-01-30', end: '2026-02-13' },
      { start: '2026-02-14', end: '2026-02-28' },
      { start: '2026-03-01', end: '2026-03-15' },
    ]);
  });

  it('clips the trailing cycle to billThroughDate when it falls mid-cycle', () => {
    const cycles = generateLotBillingCycles({
      receiptDate: '2026-01-30',
      periodDays: 15,
      billedThroughDate: '2026-01-29',
      billThroughDate: '2026-02-19', // 6 days into the 2nd cycle
    });
    expect(cycles).toEqual([
      { start: '2026-01-30', end: '2026-02-13' },
      { start: '2026-02-14', end: '2026-02-19' },
    ]);
  });

  it('resumes aligned to the original grid after a prior partial (mid-cycle) cutoff', () => {
    // Picks up right where the previous test's partial cycle left off, and
    // finishes that same grid cell rather than starting a new misaligned one.
    const cycles = generateLotBillingCycles({
      receiptDate: '2026-01-30',
      periodDays: 15,
      billedThroughDate: '2026-02-19',
      billThroughDate: '2026-02-28',
    });
    expect(cycles).toEqual([{ start: '2026-02-20', end: '2026-02-28' }]);
  });

  it('returns nothing when already billed through the requested cutoff', () => {
    const cycles = generateLotBillingCycles({
      receiptDate: '2026-01-30',
      periodDays: 15,
      billedThroughDate: '2026-02-28',
      billThroughDate: '2026-02-28',
    });
    expect(cycles).toEqual([]);
  });

  it('returns nothing when no billedThroughDate is provided (caller must require a seed first)', () => {
    const cycles = generateLotBillingCycles({
      receiptDate: '2026-01-30',
      periodDays: 15,
      billedThroughDate: null,
      billThroughDate: '2026-03-15',
    });
    expect(cycles).toEqual([]);
  });
});

describe('resolveServiceRate', () => {
  it('prefers a product-specific rate over a customer-wide one', () => {
    const rates = [
      { ...STORAGE_RATE_30D, id: 'generic' },
      { ...STORAGE_RATE_30D, id: 'specific', customer_product_id: 'prod-1' },
    ];
    const rate = resolveServiceRate(rates, {
      customerId: 'cust-1', customerProductId: 'prod-1', temperatureType: null, serviceType: 'STORAGE',
    });
    expect(rate.id).toBe('specific');
  });
});
