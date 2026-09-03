import { describe, expect, it } from 'vitest';
import { mapWithConcurrencyLimit } from '../../src/utils/asyncBatch.js';

describe('mapWithConcurrencyLimit', () => {
  it('preserves result order regardless of completion order', async () => {
    const items = [30, 10, 20, 5, 15];
    const results = await mapWithConcurrencyLimit(items, 2, (ms) => new Promise((resolve) => {
      setTimeout(() => resolve(ms), ms);
    }));
    expect(results).toEqual(items);
  });

  it('never runs more than `limit` calls concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrencyLimit(items, 3, async (i) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return i * 2;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('handles an item count smaller than the limit', async () => {
    const results = await mapWithConcurrencyLimit([1, 2], 8, (n) => Promise.resolve(n * 10));
    expect(results).toEqual([10, 20]);
  });

  it('handles an empty list', async () => {
    const results = await mapWithConcurrencyLimit([], 5, () => Promise.resolve('unused'));
    expect(results).toEqual([]);
  });
});
