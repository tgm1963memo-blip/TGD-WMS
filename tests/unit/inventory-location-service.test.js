import { describe, expect, it, vi } from 'vitest';

async function service({ failPicks = false } = {}) {
  vi.resetModules();
  const allocations = Array.from({ length: 1001 }, (_, index) => ({
    id: `a${index}`, line_id: 'line', location_id: 'location', pallet_no: index + 1,
    boxes: index === 0 ? 1100 : 10, weight: 100, tgd_locations: { location_code: '42-L-28' },
  }));
  allocations.push({ id: 'empty', line_id: 'line', location_id: 'location2', pallet_no: 1, boxes: 1, weight: 1, tgd_locations: { location_code: '41-L-01' } });
  const picks = Array.from({ length: 1001 }, (_, index) => ({ id: `p${index}`, deposit_line_location_id: 'a0', boxes: 1, weight: 0.01 }));
  picks.push({ id: 'last', deposit_line_location_id: 'empty', boxes: 1, weight: 1 });
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: {
    from(table) {
      let rows = table === 'tgd_customer_deposit_line_locations' ? allocations : picks;
      const query = {
        select: () => query, order: () => query, eq: () => query,
        in: (field, ids) => { expect(ids.length).toBeLessThanOrEqual(150); rows = rows.filter(row => ids.includes(row[field])); return query; },
        single: () => Promise.resolve({ data: { actual_boxes: 12000, actual_weight: 200000 }, error: null }),
        range: (from, to) => Promise.resolve(table === 'tgd_customer_withdrawal_line_pallet_picks' && failPicks
          ? { error: new Error('Picks unavailable'), data: null } : { data: rows.slice(from, to + 1), error: null }),
      };
      return query;
    },
  } }));
  return import('../../src/services/inventoryLocationService.js');
}

describe('inventory location data', () => {
  it('paginates allocations and picks and hides fully picked pallets', async () => {
    const api = await service();
    const result = await api.listInventoryLocations(['line', 'unassigned']);
    expect(result.error).toBeNull();
    expect(result.data.get('line')).toHaveLength(1002);
    expect(result.data.get('unassigned')).toEqual([]);
    expect(result.data.get('line')[0].remainingBoxes).toBe(99);
    expect(result.data.get('line').at(-1).active).toBe(false);
    expect(api.inventoryLocationLabel(result.data.get('line'))).toContain('42-L-28-1001');
    expect(api.inventoryLocationLabel(result.data.get('line'))).not.toContain('41-L-01');
    expect(api.inventoryLocationLabel([])).toBe('');
  });
  it('calculates unallocated quantity from raw receipt minus all allocations, including depleted ones', async () => {
    const api = await service();
    const result = await api.getInventoryLocationEditor('line');
    expect(result.data.unallocatedBoxes).toBe(899);
    expect(result.data.unallocatedWeight).toBe(99899);
  });
  it('does not interpret unreadable pick history as empty history', async () => {
    const api = await service({ failPicks: true });
    const result = await api.listInventoryLocations(['line']);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('Picks unavailable');
  });
  it('limits edits to the three selected roles, excluding accounting and warehouse staff', async () => {
    const api = await service();
    for (const role of ['admin', 'warehouse_admin', 'warehouse_manager']) expect(api.canManageInventoryLocation(role)).toBe(true);
    for (const role of ['viewer', 'accounting', 'warehouse_staff', 'customer_admin', null]) expect(api.canManageInventoryLocation(role)).toBe(false);
  });
});
