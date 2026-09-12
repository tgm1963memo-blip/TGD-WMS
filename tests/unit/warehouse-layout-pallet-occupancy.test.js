import { describe, expect, it, vi } from 'vitest';

// Regression coverage for the pallet-split occupancy model: a row's
// occupancy is now a COUNT of pallets in use (tgd_customer_deposit_line_locations)
// minus whatever's already been picked out (tgd_customer_withdrawal_line_pallet_picks),
// not a binary tgd_stock_balances lookup. See the 20260912090000 migration and
// warehouseLayoutService.js's getSectionsWithOccupancy/getPalletDetailsAtLocation.

function chainableSelect(result) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('getSectionsWithOccupancy', () => {
  it('counts a location occupied via an unpicked pallet allocation', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_zones') {
            return chainableSelect({
              data: [{
                id: 'zone-1', zone_code: '41', zone_name: 'ห้องเย็น 41', temperature_type: 'FROZEN', is_active: true,
                tgd_rooms: [{ id: 'room-1', tgd_locations: [{ id: 'loc-1', location_code: '41-L-01', capacity: 14 }] }],
              }],
              error: null,
            });
          }
          if (table === 'tgd_customer_deposit_line_locations') {
            return chainableSelect({ data: [{ id: 'alloc-1', location_id: 'loc-1', boxes: 5 }], error: null });
          }
          if (table === 'tgd_customer_withdrawal_line_pallet_picks') {
            return chainableSelect({ data: [], error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    }));
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');

    const { data } = await getSectionsWithOccupancy();

    expect(data).toHaveLength(1);
    expect(data[0].used).toBe(1);
    expect(data[0].empty).toBe(13);
    expect(data[0].locations[0].isOccupied).toBe(true);
    expect(data[0].locations[0].usedCount).toBe(1);
  });

  it('does not count a pallet that has been fully picked out', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_zones') {
            return chainableSelect({
              data: [{
                id: 'zone-1', zone_code: '41', zone_name: 'ห้องเย็น 41', temperature_type: 'FROZEN', is_active: true,
                tgd_rooms: [{ id: 'room-1', tgd_locations: [{ id: 'loc-1', location_code: '41-L-01', capacity: 14 }] }],
              }],
              error: null,
            });
          }
          if (table === 'tgd_customer_deposit_line_locations') {
            return chainableSelect({ data: [{ id: 'alloc-1', location_id: 'loc-1', boxes: 5 }], error: null });
          }
          if (table === 'tgd_customer_withdrawal_line_pallet_picks') {
            return chainableSelect({ data: [{ deposit_line_location_id: 'alloc-1', boxes: 5 }], error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    }));
    const { getSectionsWithOccupancy } = await import('../../src/services/warehouseLayoutService.js');

    const { data } = await getSectionsWithOccupancy();

    expect(data[0].used).toBe(0);
    expect(data[0].locations[0].isOccupied).toBe(false);
  });

  it('leaves a location empty when it has no allocations', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_zones') {
            return chainableSelect({
              data: [{
                id: 'zone-1', zone_code: '41', zone_name: 'ห้องเย็น 41', temperature_type: 'FROZEN', is_active: true,
                tgd_rooms: [{ id: 'room-1', tgd_locations: [{ id: 'loc-1', location_code: '41-L-01', capacity: 14 }] }],
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

describe('getPalletDetailsAtLocation', () => {
  it('returns per-pallet details joined to the deposit line, excluding fully-picked pallets', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          if (table === 'tgd_locations') {
            return chainableSelect({ data: { capacity: 14 }, error: null });
          }
          if (table === 'tgd_customer_deposit_line_locations') {
            return chainableSelect({
              data: [
                {
                  id: 'alloc-1', pallet_no: 1, boxes: 5, weight: 50, line_id: 'line-1',
                  tgd_customer_deposit_request_lines: { tracking_code: 'TRK-1', product_name: 'Sample Product', customer_product_code: 'SAMPLE-001' },
                },
                {
                  id: 'alloc-2', pallet_no: 2, boxes: 3, weight: 30, line_id: 'line-2',
                  tgd_customer_deposit_request_lines: { tracking_code: 'TRK-2', product_name: 'Other Product', customer_product_code: 'OTHER-001' },
                },
              ],
              error: null,
            });
          }
          if (table === 'tgd_customer_withdrawal_line_pallet_picks') {
            return chainableSelect({ data: [{ deposit_line_location_id: 'alloc-2', boxes: 3 }], error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
    }));
    const { getPalletDetailsAtLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { data, error } = await getPalletDetailsAtLocation('loc-1');

    expect(error).toBeNull();
    expect(data.capacity).toBe(14);
    expect(data.pallets).toHaveLength(1);
    expect(data.pallets[0]).toMatchObject({
      palletNo: 1, boxes: 5, remainingBoxes: 5, trackingCode: 'TRK-1', productName: 'Sample Product',
    });
  });
});
