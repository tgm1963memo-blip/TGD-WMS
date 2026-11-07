import { describe, expect, it, vi } from 'vitest';

// getPickedQuantitiesByAllocationId must read past PostgREST's 1000-row cap
// retry once when the effective-picks view fails, then fall back to raw
// pallet picks and flag the occupancy totals as an estimate.

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

const rpcRefused = async () => ({ data: null, error: { message: 'ไม่มีสิทธิ์นับสต็อก' } });

describe('getPickedQuantitiesByAllocationId', () => {
  it('uses the fast function and skips the view when it answers', async () => {
    vi.resetModules();
    const rpc = vi.fn(async () => ({ data: [{ allocation_id: 'alloc-1', picked_boxes: 4, picked_weight: 2 }], error: null }));
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: { rpc, from: (table) => { throw new Error(table); } },
    }));
    const { getPickedQuantitiesByAllocationId } = await import('../../src/services/warehouseLayoutService.js');
    const map = await getPickedQuantitiesByAllocationId(['alloc-1']);
    expect(rpc).toHaveBeenCalledWith('tgd_get_deposit_line_location_picked', { p_allocation_ids: ['alloc-1'] });
    expect(map.get('alloc-1')).toEqual({ boxes: 4, weight: 2 });
  });

  it('reads every page of the view (more than 1000 rows)', async () => {
    vi.resetModules();
    const rows = Array.from({ length: 2500 }, (_, i) => ({ allocation_id: `a${i}`, picked_boxes: 1, picked_weight: 0 }));
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: { rpc: rpcRefused, from: (table) => { if (table !== 'tgd_deposit_line_location_picked') throw new Error(table); return pagedTable(rows)(); } },
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
        rpc: rpcRefused,
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

  it('retries the view once, so a passing failure never reaches the fallback', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let viewReads = 0;
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        rpc: rpcRefused,
        from: (table) => {
          if (table !== 'tgd_deposit_line_location_picked') throw new Error(table);
          viewReads += 1;
          return viewReads === 1
            ? pagedTable([], { error: { code: '57014', message: 'canceling statement due to statement timeout' } })()
            : pagedTable([{ allocation_id: 'alloc-1', picked_boxes: 7, picked_weight: 0 }])();
        },
      },
    }));
    const { getPickedQuantitiesByAllocationId } = await import('../../src/services/warehouseLayoutService.js');
    const map = await getPickedQuantitiesByAllocationId(['alloc-1']);
    expect(viewReads).toBe(2);
    expect(map.get('alloc-1')).toEqual({ boxes: 7, weight: 0 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('getSectionsWithOccupancy isEstimate', () => {
  const zones = [{ id: 'z1', zone_code: 'A', zone_name: 'A', is_active: true, tgd_rooms: [{ id: 'r1', tgd_locations: [{ id: 'l1', location_code: 'A-1', capacity: 2 }] }] }];
  const allocations = [{ id: 'alloc-1', location_id: 'l1', pallet_no: 1, boxes: 5, weight: null }];

  function mockSupabase({ viewError = null, viewRows = [] }) {
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        rpc: rpcRefused,
        from: (table) => {
          if (table === 'tgd_zones') {
            const query = { select: () => query, eq: () => query, order: () => Promise.resolve({ data: zones, error: null }) };
            return query;
          }
          if (table === 'tgd_customer_deposit_line_locations') return pagedTable(allocations)();
          if (table === 'tgd_deposit_line_location_picked') return pagedTable(viewRows, { error: viewError })();
          if (table === 'tgd_customer_withdrawal_line_pallet_picks') return pagedTable([])();
          throw new Error(table);
        },
      },
    }));
  }

  it('is false when the view answers', async () => {
    vi.resetModules();
    mockSupabase({ viewRows: [{ allocation_id: 'alloc-1', picked_boxes: 5, picked_weight: 0 }] });
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');
    const result = await getSectionsWithOccupancy();
    expect(result.isEstimate).toBe(false);
    expect(result.data[0].used).toBe(0);
  });

  it('is true when the totals came from the fallback', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSupabase({ viewError: { message: 'timeout' } });
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');
    const result = await getSectionsWithOccupancy();
    expect(result.isEstimate).toBe(true);
    expect(result.data[0].used).toBe(1);
    warn.mockRestore();
  });
});
