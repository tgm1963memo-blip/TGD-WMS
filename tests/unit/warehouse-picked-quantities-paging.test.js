import { describe, expect, it, vi } from 'vitest';

// getPickedQuantitiesByAllocationId must read past PostgREST's 1000-row cap
// and fall back to raw pallet picks when the effective-picks view fails.

function pagedTable(allRows, { error = null } = {}) {
  return () => {
    let range = [0, allRows.length - 1];
    const query = {
      select: () => query,
      order: () => query,
      in: () => query,
      range: (from, to) => { range = [from, to]; return query; },
      then: (resolve, reject) => Promise.resolve(
        error ? { data: null, error } : { data: allRows.slice(range[0], range[1] + 1), error: null },
      ).then(resolve, reject),
    };
    return query;
  };
}

describe('getPickedQuantitiesByAllocationId', () => {
  it('reads every page of the view (more than 1000 rows)', async () => {
    vi.resetModules();
    const rows = Array.from({ length: 2500 }, (_, i) => ({ allocation_id: `a${i}`, picked_boxes: 1, picked_weight: 0 }));
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: { from: (table) => { if (table !== 'tgd_deposit_line_location_picked') throw new Error(table); return pagedTable(rows)(); } },
    }));
    const { getPickedQuantitiesByAllocationId } = await import('../../src/services/warehouseLayoutService.js');
    const map = await getPickedQuantitiesByAllocationId();
    expect(map.size).toBe(2500);
    expect(map.get('a2499')).toEqual({ boxes: 1, weight: 0 });
  });

  it('falls back to raw pallet picks when the view errors', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_deposit_line_location_picked') return pagedTable([], { error: { message: 'relation does not exist' } })();
          if (table === 'tgd_customer_withdrawal_line_pallet_picks') {
            return pagedTable([
              { id: 'p1', deposit_line_location_id: 'alloc-1', boxes: 3, weight: null },
              { id: 'p2', deposit_line_location_id: 'alloc-1', boxes: 2, weight: null },
            ])();
          }
          throw new Error(table);
        },
      },
    }));
    const { getPickedQuantitiesByAllocationId } = await import('../../src/services/warehouseLayoutService.js');
    const map = await getPickedQuantitiesByAllocationId(['alloc-1']);
    expect(map.get('alloc-1')).toEqual({ boxes: 5, weight: 0 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
