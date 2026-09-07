import { describe, expect, it, vi } from 'vitest';

// Regression coverage: the handheld "Update Location" scan flow only ever
// writes tgd_customer_deposit_request_lines.location_id -- it never touches
// tgd_stock_balances. Before this fix, the warehouse map (getSectionsWithOccupancy)
// and its click-through detail (getStockAtLocation) only read tgd_stock_balances,
// so a location just assigned via a scan kept showing as empty on the
// dashboard. Both now fall back to tgd_customer_deposit_request_lines,
// mirroring the same fallback checkLocationHasInventory already used.

function chainableSelect(result) {
  const query = {
    select: () => query,
    eq: () => query,
    gt: () => query,
    or: () => query,
    not: () => query,
    order: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('getSectionsWithOccupancy', () => {
  it('marks a location occupied via a deposit line even with no matching tgd_stock_balances row', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_zones') {
            return chainableSelect({
              data: [{
                id: 'zone-1', zone_code: '41', zone_name: 'ห้องเย็น 41', temperature_type: 'FROZEN', is_active: true,
                tgd_rooms: [{ id: 'room-1', tgd_locations: [{ id: 'loc-1', location_code: '41-L-01-01-01' }] }],
              }],
              error: null,
            });
          }
          if (table === 'tgd_stock_balances') {
            return chainableSelect({ data: [], error: null });
          }
          if (table === 'tgd_customer_deposit_request_lines') {
            return chainableSelect({ data: [{ location_id: 'loc-1', actual_boxes: 5, actual_weight: 50 }], error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    }));
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');

    const { data } = await getSectionsWithOccupancy();

    expect(data).toHaveLength(1);
    expect(data[0].used).toBe(1);
    expect(data[0].empty).toBe(0);
    expect(data[0].locations[0].isOccupied).toBe(true);
  });

  it('leaves a location empty when neither source has stock there', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_zones') {
            return chainableSelect({
              data: [{
                id: 'zone-1', zone_code: '41', zone_name: 'ห้องเย็น 41', temperature_type: 'FROZEN', is_active: true,
                tgd_rooms: [{ id: 'room-1', tgd_locations: [{ id: 'loc-1', location_code: '41-L-01-01-01' }] }],
              }],
              error: null,
            });
          }
          return chainableSelect({ data: [], error: null });
        },
      },
    }));
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');

    const { data } = await getSectionsWithOccupancy();

    expect(data[0].used).toBe(0);
    expect(data[0].locations[0].isOccupied).toBe(false);
  });
});

describe('getStockAtLocation', () => {
  it('falls back to a matching deposit line when tgd_stock_balances has nothing for this location', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_stock_balances') return chainableSelect({ data: [], error: null });
          if (table === 'tgd_customer_deposit_request_lines') {
            return chainableSelect({
              data: [{
                id: 'line-1', actual_boxes: 5, actual_weight: 50, uom: 'กล่อง', lot_no: 'LOT-1', exp_date: '2026-12-01',
                product_id: null, product_name: 'Sample Product', customer_product_code: 'SAMPLE-001',
                tgd_customer_deposit_requests: { customer_id: 'cust-1' },
              }],
              error: null,
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    }));
    const { getStockAtLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { data, error } = await getStockAtLocation('loc-1');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      qty_on_hand: 5, customer_id: 'cust-1', product_name: 'Sample Product',
      tgd_lots: { lot_number: 'LOT-1', expiry_date: '2026-12-01' },
    });
  });

  it('does not fall back when tgd_stock_balances already has a row for this location', async () => {
    vi.resetModules();
    const depositFromSpy = vi.fn();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_stock_balances') {
            return chainableSelect({ data: [{ id: 'bal-1', qty_on_hand: 10, qty_allocated: 0 }], error: null });
          }
          depositFromSpy(table);
          return chainableSelect({ data: [], error: null });
        },
      },
    }));
    const { getStockAtLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { data } = await getStockAtLocation('loc-1');

    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('bal-1');
    expect(depositFromSpy).not.toHaveBeenCalled();
  });
});
