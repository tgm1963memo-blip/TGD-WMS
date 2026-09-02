import { describe, expect, it } from 'vitest';
import {
  computeStorageInvoiceLines, computeAuxiliaryServiceLines, resolveServiceRate, generateLotBillingCycles,
  computeHandlingFeeLines,
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

  it('still bills the cycle a withdrawal lands exactly on the start of — the goods left sometime during that day, not before it began', () => {
    // Regression: a real reported mismatch against an independent reference
    // calculation traced to this exact boundary. Deposit 1000kg Jan 1
    // (cycle 1: Jan 1-30, cycle 2 starts Jan 31); a withdrawal dated exactly
    // 2026-01-31 must still count as present for cycle 2 (billed in full),
    // and only excludes cycle 3 (starts ~Mar 2) onward. The previous <=
    // comparison treated a same-day withdrawal as "already gone before this
    // cycle started", silently dropping that cycle's charge entirely.
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01',
        withdrawal_events: [{ weight: 1000, date: '2026-01-31' }],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-03-15',
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ periodStart: '2026-01-01', periodEnd: '2026-01-30', weight: 1000, amount: 5000 });
    expect(lines[1]).toMatchObject({ periodStart: '2026-01-31', periodEnd: '2026-03-01', weight: 1000, amount: 5000 });
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

  it('zeroes out a cycle that starts within the contract free_days window, tagging it as free rather than skipping it', () => {
    const freeRate = { ...STORAGE_RATE_30D, free_days: 10 };
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [freeRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-10',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ amount: 0, freePeriodApplied: true, weight: 1000 });
  });

  it('bills full cycles again once a later cycle starts after the free_days window has passed', () => {
    const freeRate = { ...STORAGE_RATE_30D, free_days: 10 };
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [freeRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-31', // 2nd cycle starts Jan 31, past day 10
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ amount: 0, freePeriodApplied: true });
    expect(lines[1].amount).toBe(5000);
    expect(lines[1].freePeriodApplied).toBeFalsy();
  });

  it('applies discount_percent to the computed amount and records the discount', () => {
    const discountRate = { ...STORAGE_RATE_30D, discount_percent: 10 };
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [discountRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-10',
    });
    // raw 1000 * 5 = 5000, less 10% = 4500
    expect(line.amount).toBe(4500);
    expect(line.discountAmount).toBe(500);
    expect(line.adjustmentNote).toContain('ส่วนลด');
  });

  it('tops up to min_charge_amount when the computed amount falls below the floor', () => {
    const minChargeRate = { ...STORAGE_RATE_30D, rate: 0.01, min_charge_amount: 500 };
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 10, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [minChargeRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-10',
    });
    // raw 10 * 0.01 = 0.1, well under the 500 floor
    expect(line.amount).toBe(500);
    expect(line.minChargeApplied).toBe(true);
    expect(line.minChargeTopupAmount).toBe(499.9);
  });

  it('does not resolve a rate whose contract window has not started yet as of the receipt date, leaving the deposit line unrated', () => {
    const futureRate = { ...STORAGE_RATE_30D, contract_start_date: '2026-02-01' };
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [futureRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(lines).toHaveLength(0);
  });

  it('does not resolve a rate whose contract window already expired as of the receipt date', () => {
    const expiredRate = { ...STORAGE_RATE_30D, contract_end_date: '2025-12-31' };
    const lines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [expiredRate],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    expect(lines).toHaveLength(0);
  });

  // Real reported gap: OVO/FROZEN had 124 storage cycles counted in BOTH
  // the July 2026 and August 2026 invoice drafts (each draft created
  // independently, one calendar month at a time) -- a cycle straddling
  // the month boundary (e.g. starts 2026-07-31, a 15-day rate ends
  // 2026-08-14) was "still in progress" when August's periodStart opened,
  // so it got billed again there on top of July's own draft already
  // having billed it in full. ~94,665.93 THB counted twice. Fixed by
  // attributing each cycle to exactly the one period it STARTS in.
  it('does not re-bill a cycle that already started in an earlier period, even though that cycle is still open when this period begins', () => {
    const rate15d = { ...STORAGE_RATE_30D, period_days: 15 };
    const depositLines = [{
      id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
      received_weight: 1000, receipt_date: '2026-07-01', withdrawal_events: [],
    }];

    // July's own draft: periodStart=periodEnd of the same month, receipt_date
    // aligns with periodStart so cycle 0 (Jul1-15), cycle 1 (Jul16-30), and
    // cycle 2 (Jul31-Aug14, straddling into August) all start on/before Jul31.
    const julyLines = computeStorageInvoiceLines({
      depositLines, rates: [rate15d], periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    expect(julyLines.map((l) => l.periodStart)).toEqual(['2026-07-01', '2026-07-16', '2026-07-31']);
    expect(julyLines[2]).toMatchObject({ periodStart: '2026-07-31', periodEnd: '2026-08-14', amount: 5000 });

    // August's own draft must NOT re-include the 2026-07-31 cycle July
    // already billed -- its first line should start with the next cycle
    // that genuinely begins on/after 2026-08-01.
    const augustLines = computeStorageInvoiceLines({
      depositLines, rates: [rate15d], periodStart: '2026-08-01', periodEnd: '2026-08-31',
    });
    expect(augustLines.map((l) => l.periodStart)).not.toContain('2026-07-31');
    expect(augustLines[0]).toMatchObject({ periodStart: '2026-08-15', periodEnd: '2026-08-29' });

    // No cycle appears in both months' output.
    const julyStarts = new Set(julyLines.map((l) => l.periodStart));
    const augustStarts = new Set(augustLines.map((l) => l.periodStart));
    const overlap = [...julyStarts].filter((s) => augustStarts.has(s));
    expect(overlap).toEqual([]);
  });

  it('still bills a cycle in full the moment it begins, even when the period boundary lands mid-cycle ("เต็มรอบทันที" preserved)', () => {
    // Same straddling cycle as above (Jul31-Aug14) -- confirms it's still
    // billed in FULL by whichever period it starts in, not skipped/dropped
    // and not prorated, only ever counted once.
    const rate15d = { ...STORAGE_RATE_30D, period_days: 15 };
    const julyLines = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-07-01', withdrawal_events: [],
      }],
      rates: [rate15d], periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    const straddling = julyLines.find((l) => l.periodStart === '2026-07-31');
    expect(straddling).toMatchObject({ periodEnd: '2026-08-14', weight: 1000, amount: 5000 });
  });

  it('still resolves a rate with no contract window set at all, exactly as before contract fields existed', () => {
    const [line] = computeStorageInvoiceLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-01-01', withdrawal_events: [],
      }],
      rates: [STORAGE_RATE_30D],
      periodStart: '2026-01-01', periodEnd: '2026-01-10',
    });
    expect(line.amount).toBe(5000);
  });
});

describe('computeHandlingFeeLines', () => {
  const HANDLING_IN_RATE = {
    id: 'rate-hi', service_type: 'HANDLING_IN', unit_basis: 'PER_KG',
    rate: 0.17, period_days: null, is_active: true, customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
  };

  it('charges once, on the received weight, only in the period containing the receipt date', () => {
    const [line] = computeHandlingFeeLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-07-15',
      }],
      rates: [HANDLING_IN_RATE],
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    expect(line.amount).toBeCloseTo(170, 2);
  });

  it('does not charge again in a later period for a lot received in an earlier one ("first entry only")', () => {
    const lines = computeHandlingFeeLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-06-30',
      }],
      rates: [HANDLING_IN_RATE],
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    expect(lines).toHaveLength(0);
  });

  it('silently skips (not an error) a deposit line whose customer has no HANDLING_IN rate configured', () => {
    const lines = computeHandlingFeeLines({
      depositLines: [{
        id: 'dl-1', customer_id: 'cust-1', customer_product_id: null, temperature_type: null,
        received_weight: 1000, receipt_date: '2026-07-15',
      }],
      rates: [], // no rates configured at all for this customer
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    expect(lines).toHaveLength(0);
  });
});

describe('computeAuxiliaryServiceLines', () => {
  it('caps quantity at max_quantity and rounds the amount', () => {
    const [line] = computeAuxiliaryServiceLines({
      selections: [{
        sourceRequestId: 'req-1', customerId: 'cust-1',
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

  it('ignores contract_start_date/contract_end_date entirely when asOfDate is omitted (default-null path unchanged)', () => {
    const rate = resolveServiceRate([{ ...STORAGE_RATE_30D, contract_start_date: '2099-01-01' }], {
      customerId: 'cust-1', customerProductId: null, temperatureType: null, serviceType: 'STORAGE',
    });
    expect(rate).not.toBeNull();
  });

  it('rejects a candidate whose contract window does not cover asOfDate when asOfDate is provided', () => {
    const rate = resolveServiceRate([{ ...STORAGE_RATE_30D, contract_start_date: '2099-01-01' }], {
      customerId: 'cust-1', customerProductId: null, temperatureType: null, serviceType: 'STORAGE',
      asOfDate: '2026-01-01',
    });
    expect(rate).toBeNull();
  });
});
