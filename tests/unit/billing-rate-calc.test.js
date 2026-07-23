import { describe, expect, it } from 'vitest';
import {
  computeStorageInvoiceLines, computeAuxiliaryServiceLines, resolveServiceRate, generateLotBillingCycles,
} from '../../src/utils/billingRateCalc.js';

const STORAGE_RATE_30D = {
  id: 'rate-1', service_type: 'STORAGE', unit_basis: 'PER_KG',
  rate: 5, period_days: 30, is_active: true, customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
};

describe('computeStorageInvoiceLines', () => {
  it('prorates by exact days instead of rounding up whole periods', () => {
    // 31-day window against a 30-day rate used to bill ceil(31/30)=2 whole
    // periods (double); it should now bill ~31/30 periods proportionally.
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(line.days).toBe(31);
    expect(line.amount).toBeCloseTo(1000 * 5 * (31 / 30), 2);
    expect(line.amount).toBeLessThan(1000 * 5 * 2);
  });

  it('reduces the chargeable weight from the date of a partial withdrawal, not just at 100% depletion', () => {
    // Deposit 1000kg on Jan 1, withdraw 600kg on Jan 16, period Jan 1-31.
    // Days 1-15 @ 1000kg (15 days) + days 16-31 @ 400kg (16 days).
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01',
        withdrawal_events: [{ weight: 600, date: '2026-01-16' }],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    const expectedWeightDays = 1000 * 15 + 400 * 16;
    expect(line.weightDays).toBeCloseTo(expectedWeightDays, 5);
    expect(line.amount).toBeCloseTo((expectedWeightDays / 30) * 5, 2);
    // Sanity: this must be less than billing the full 1000kg the whole period.
    expect(line.amount).toBeLessThan(1000 * 5 * (31 / 30));
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
    expect(Number.isInteger(line.amount * 100)).toBe(true);
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
