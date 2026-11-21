import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: null }));

const { summarizeStorageMonth } = await import('../../src/services/billingRateEngineService.js');

// The dashboard revenue card can switch to billed weight. The weight comes
// from the same storage lines as the amount: each charged cycle's weight on
// hand when it began.

const names = new Map([['c1', 'บริษัท ไทย'], ['c2', 'OVO Foodtech']]);

describe('summarizeStorageMonth', () => {
  it('totals amount and billed weight overall and per customer', () => {
    const result = summarizeStorageMonth([
      { customerId: 'c1', amount: 1000, weight: 500 },
      { customerId: 'c1', amount: 200.25, weight: 100.5 },
      { customerId: 'c2', amount: 3000, weight: 1500 },
    ], names);

    expect(result.amount).toBe(4200.25);
    expect(result.weight).toBe(2100.5);
    expect(result.byCustomer).toEqual([
      { customerId: 'c2', customerName: 'OVO Foodtech', amount: 3000, weight: 1500 },
      { customerId: 'c1', customerName: 'บริษัท ไทย', amount: 1200.25, weight: 600.5 },
    ]);
  });

  it('leaves free-period cycles out of the weight', () => {
    const result = summarizeStorageMonth([
      { customerId: 'c1', amount: 0, weight: 800, freePeriodApplied: true },
      { customerId: 'c1', amount: 500, weight: 250 },
    ], names);

    expect(result.amount).toBe(500);
    expect(result.weight).toBe(250);
    expect(result.byCustomer[0]).toMatchObject({ amount: 500, weight: 250 });
  });

  it('groups lines with no customer and falls back to the id for unknown names', () => {
    const result = summarizeStorageMonth([
      { customerId: null, amount: 10, weight: 5 },
      { customerId: 'c9', amount: 20, weight: 4 },
    ], names);

    expect(result.byCustomer.map((c) => c.customerName)).toEqual(['c9', 'UNASSIGNED']);
  });

  it('returns zeros for an empty month', () => {
    expect(summarizeStorageMonth([], names)).toEqual({ amount: 0, weight: 0, byCustomer: [] });
  });
});
