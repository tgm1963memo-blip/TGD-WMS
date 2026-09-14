import { describe, expect, it, vi } from 'vitest';

// Regression coverage for per-ROW (not per-zone) location delete/edit, added
// so TGC warehouse staff can fix a single mistaken row (delete it, resize
// its capacity, or move it to a different room/side/row) without touching
// every other row in the same zone. See warehouseLayoutService.js's
// deleteLocation/updateLocation/getOccupiedPalletCountByLocationId.
//
// Occupancy is checked against tgd_customer_deposit_line_locations (the
// pallet-split allocation table), NOT the older tgd_stock_balances/
// tgd_customer_deposit_request_lines.location_id pair updateSectionSize used
// to rely on before this fix -- see the sibling occupancy tests in
// warehouse-layout-pallet-occupancy.test.js for that same table's other uses.

// Queues one result per call to a given table -- lets a single test mock
// tgd_locations differently across the several distinct queries one
// updateLocation() call makes against it (fetch current row, check a
// collision, then the final update), unlike the simpler single-result mock
// used elsewhere in this suite.
function makeQueuedSupabaseMock(responsesByTable) {
  const callIndexByTable = {};
  const from = vi.fn((table) => {
    const queue = responsesByTable[table] ?? [];
    const idx = callIndexByTable[table] ?? 0;
    callIndexByTable[table] = idx + 1;
    const result = queue[idx] ?? queue[queue.length - 1] ?? { data: null, error: null };
    const builder = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      in: () => builder,
      limit: () => builder,
      order: () => builder,
      maybeSingle: () => Promise.resolve(result),
      delete: () => builder,
      update: vi.fn(() => builder),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

describe('getOccupiedPalletCountByLocationId', () => {
  it('counts only pallets with remaining (unpicked) boxes, per location', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_customer_deposit_line_locations: [{
          data: [
            { id: 'alloc-1', location_id: 'loc-1', boxes: 5 },
            { id: 'alloc-2', location_id: 'loc-1', boxes: 3 },
            { id: 'alloc-3', location_id: 'loc-2', boxes: 2 },
          ],
          error: null,
        }],
        tgd_customer_withdrawal_line_pallet_picks: [{
          data: [{ deposit_line_location_id: 'alloc-2', boxes: 3 }], // alloc-2 fully picked out
          error: null,
        }],
      }),
    }));
    const { getOccupiedPalletCountByLocationId } = await import('../../src/services/warehouseLayoutService.js');

    const result = await getOccupiedPalletCountByLocationId(['loc-1', 'loc-2']);

    expect(result.get('loc-1')).toBe(1); // alloc-1 still has stock, alloc-2 doesn't
    expect(result.get('loc-2')).toBe(1);
  });
});

describe('deleteLocation', () => {
  it('blocks deleting a row that still holds a pallet with remaining stock', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_customer_deposit_line_locations: [{ data: [{ id: 'alloc-1', location_id: 'loc-1', boxes: 5 }], error: null }],
        tgd_customer_withdrawal_line_pallet_picks: [{ data: [], error: null }],
      }),
    }));
    const { deleteLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await deleteLocation('loc-1');

    expect(error).not.toBeNull();
    expect(error.message).toContain('มีสินค้าอยู่');
  });

  it('deletes a row with no remaining stock', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_customer_deposit_line_locations: [{ data: [], error: null }],
        tgd_customer_withdrawal_line_pallet_picks: [{ data: [], error: null }],
        tgd_locations: [{ data: null, error: null }],
      }),
    }));
    const { deleteLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await deleteLocation('loc-1');

    expect(error).toBeNull();
  });
});

describe('updateLocation', () => {
  const CURRENT_ROW = {
    id: 'loc-1', zone_id: 'zone-41', room_id: 'room-41', location_code: '41-L-05', location_name: 'ห้องเย็น 41 ฝั่งซ้าย แถว 5', capacity: 14,
  };

  it('blocks reducing capacity below the pallets actually in use', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_locations: [{ data: CURRENT_ROW, error: null }],
        tgd_customer_deposit_line_locations: [{
          data: [{ id: 'a1', location_id: 'loc-1', boxes: 1 }, { id: 'a2', location_id: 'loc-1', boxes: 1 }, { id: 'a3', location_id: 'loc-1', boxes: 1 }],
          error: null,
        }],
        tgd_customer_withdrawal_line_pallet_picks: [{ data: [], error: null }],
      }),
    }));
    const { updateLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await updateLocation('loc-1', { capacity: 2 });

    expect(error).not.toBeNull();
    expect(error.message).toContain('ลดความจุไม่ได้');
  });

  it('renames a row to a new, non-colliding code within the same zone', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_locations: [
          { data: CURRENT_ROW, error: null }, // fetch current
          { data: null, error: null }, // collision check -- none found
          { data: null, error: null }, // final update
        ],
        tgd_zones: [{ data: { id: 'zone-41', zone_name: 'ห้องเย็น 41' }, error: null }],
      }),
    }));
    const { updateLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await updateLocation('loc-1', { zoneCode: '41', side: 'L', row: 8 });

    expect(error).toBeNull();
  });

  it('blocks renaming to a code that already exists on another row', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_locations: [
          { data: CURRENT_ROW, error: null },
          { data: { id: 'some-other-loc' }, error: null }, // collision found
        ],
      }),
    }));
    const { updateLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await updateLocation('loc-1', { zoneCode: '41', side: 'L', row: 6 });

    expect(error).not.toBeNull();
    expect(error.message).toContain('มีอยู่แล้ว');
  });

  it('moves a row to a different zone/room when the room code changes', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_locations: [
          { data: CURRENT_ROW, error: null },
          { data: null, error: null }, // no collision on 42-R-03
          { data: null, error: null }, // final update
        ],
        tgd_zones: [{ data: { id: 'zone-42', zone_name: 'ห้องเย็น 42' }, error: null }],
        tgd_rooms: [{ data: { id: 'room-42' }, error: null }],
      }),
    }));
    const { updateLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await updateLocation('loc-1', { zoneCode: '42', side: 'R', row: 3 });

    expect(error).toBeNull();
  });

  it('errors when moving to a room code that does not exist', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeQueuedSupabaseMock({
        tgd_locations: [
          { data: CURRENT_ROW, error: null },
          { data: null, error: null },
        ],
        tgd_zones: [{ data: null, error: null }], // no such zone
      }),
    }));
    const { updateLocation } = await import('../../src/services/warehouseLayoutService.js');

    const { error } = await updateLocation('loc-1', { zoneCode: '99', side: 'L', row: 1 });

    expect(error).not.toBeNull();
    expect(error.message).toContain('ไม่พบห้อง');
  });
});
