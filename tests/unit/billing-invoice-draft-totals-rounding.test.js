import { describe, expect, it } from 'vitest';
import { calculateInvoiceDraftTotals } from '../../src/utils/billingInvoiceDraftUtils.js';

describe('calculateInvoiceDraftTotals rounding', () => {
  it('rounds float drift to 2 decimals', () => {
    const lines = [
      { qty: 0.1, net_weight: 0.1, gross_weight: 0.1, chargeable_weight: 0.1, amount: 0.1 },
      { qty: 0.2, net_weight: 0.2, gross_weight: 0.2, chargeable_weight: 0.2, amount: 0.2 },
    ];
    expect(calculateInvoiceDraftTotals(lines)).toEqual({
      total_qty: 0.3,
      total_net_weight: 0.3,
      total_gross_weight: 0.3,
      total_chargeable_weight: 0.3,
      total_amount: 0.3,
    });
  });

  it('keeps many 2-dp line amounts summing to an exact 2-dp total', () => {
    const lines = Array.from({ length: 3549 }, (_, i) => ({ qty: 1, net_weight: 233.13, amount: (i % 7) + 0.07 }));
    const { total_amount: total, total_net_weight: weight } = calculateInvoiceDraftTotals(lines);
    expect(Math.round(total * 100) / 100).toBe(total);
    expect(Math.round(weight * 100) / 100).toBe(weight);
  });
});
