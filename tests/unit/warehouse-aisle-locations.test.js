import { describe, expect, it, vi } from 'vitest';
import {
  parseLocationCode,
  buildLocationCode,
  formatRowLabel,
  formatSideLabel,
  sortSides,
  isAisleLocationCode,
} from '../../src/utils/locationCodeUtils.js';

// Aisle slots (side A) let staff record pallets parked in the forklift aisle
// when the shelf rows are full. They are ordinary tgd_locations rows coded
// {zone}-A-{row}; these tests pin the code format and make sure resizing a
// section can never silently delete them.

describe('aisle location codes', () => {
  it('parses and builds side A codes', () => {
    expect(parseLocationCode('41-A-30')).toEqual({ room: '41', side: 'A', row: 30 });
    expect(parseLocationCode('41-a-05')).toEqual({ room: '41', side: 'A', row: 5 });
    expect(buildLocationCode('41', 'A', 3)).toBe('41-A-03');
    expect(isAisleLocationCode('41-A-30')).toBe(true);
    expect(isAisleLocationCode('41-L-30')).toBe(false);
  });

  it('still rejects unknown sides', () => {
    expect(parseLocationCode('41-B-01')).toBeNull();
  });

  it('labels aisle slots and sides', () => {
    expect(formatRowLabel(30, 'A')).toBe('ทางเดิน 30');
    expect(formatRowLabel(0)).toBe('รอจ่าย');
    expect(formatSideLabel('A')).toBe('ทางเดิน (A)');
    expect(formatSideLabel('R')).toBe('ขวา (R)');
  });

  it('sorts the aisle after L and R so pickers never default to it', () => {
    expect(sortSides(new Set(['A', 'R', 'L']))).toEqual(['L', 'R', 'A']);
  });
});

function makeRecordingSupabaseMock(responsesByTable) {
  const calls = { deletes: [], updates: [], inserts: [] };
  const callIndexByTable = {};
  const from = vi.fn((table) => {
    const queue = responsesByTable[table] ?? [];
    const idx = callIndexByTable[table] ?? 0;
    callIndexByTable[table] = idx + 1;
    const result = queue[idx] ?? queue[queue.length - 1] ?? { data: null, error: null };
    let pending = null;
    const builder = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      limit: () => builder,
      order: () => builder,
      range: () => builder,
      in: (_col, ids) => {
        if (pending?.kind === 'delete') calls.deletes.push({ table, ids });
        if (pending?.kind === 'update') calls.updates.push({ table, ids, values: pending.values });
        return builder;
      },
      delete: () => { pending = { kind: 'delete' }; return builder; },
      update: (values) => { pending = { kind: 'update', values }; return builder; },
      insert: (rows) => { calls.inserts.push({ table, rows }); return Promise.resolve({ error: null }); },
      maybeSingle: () => Promise.resolve(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { supabase: { from, rpc: vi.fn() }, calls };
}

const EXISTING = [
  { id: 'l1', location_code: '41-L-01' },
  { id: 'l2', location_code: '41-L-02' },
  { id: 'a1', location_code: '41-A-01' },
  { id: 'a2', location_code: '41-A-02' },
];

async function loadServiceWith(mock) {
  vi.resetModules();
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: mock.supabase }));
  return import('../../src/services/warehouseLayoutService.js');
}

function baseMock() {
  return makeRecordingSupabaseMock({
    tgd_rooms: [{ data: [{ id: 'room-1' }], error: null }],
    tgd_locations: [{ data: EXISTING, error: null }, { error: null }],
    tgd_customer_deposit_line_locations: [{ data: [], error: null }],
    tgd_deposit_line_location_picked: [{ data: [], error: null }],
  });
}

describe('updateSectionSize with aisle slots', () => {
  it('keeps existing aisle slots and their capacity when no aisleConfig is passed', async () => {
    const mock = baseMock();
    const { updateSectionSize } = await loadServiceWith(mock);

    const result = await updateSectionSize('zone-41', {
      zoneCode: '41', zoneName: 'ห้อง 41',
      leftConfig: { active: true, rows: 2 }, rightConfig: { active: false, rows: 0 },
      capacity: 12,
    });

    expect(result.error ?? null).toBeNull();
    const deletedIds = mock.calls.deletes.flatMap((d) => d.ids);
    expect(deletedIds).not.toContain('a1');
    expect(deletedIds).not.toContain('a2');
    const capacityUpdate = mock.calls.updates.find((u) => u.values.capacity === 12);
    expect(capacityUpdate.ids).toEqual(['l1', 'l2']);
  });

  it('adds one aisle slot per row with its own capacity when the aisle is switched on', async () => {
    const mock = makeRecordingSupabaseMock({
      tgd_rooms: [{ data: [{ id: 'room-1' }], error: null }],
      tgd_locations: [{ data: EXISTING.slice(0, 2), error: null }, { error: null }],
      tgd_customer_deposit_line_locations: [{ data: [], error: null }],
      tgd_deposit_line_location_picked: [{ data: [], error: null }],
    });
    const { updateSectionSize } = await loadServiceWith(mock);

    await updateSectionSize('zone-41', {
      zoneCode: '41', zoneName: 'ห้อง 41',
      leftConfig: { active: true, rows: 2 }, rightConfig: { active: true, rows: 3 },
      aisleConfig: { active: true, capacity: 2 },
      capacity: 12,
    });

    const inserted = mock.calls.inserts.flatMap((i) => i.rows);
    const aisleRows = inserted.filter((r) => r.location_code.includes('-A-'));
    expect(aisleRows.map((r) => r.location_code)).toEqual(['41-A-01', '41-A-02', '41-A-03']);
    expect(aisleRows.every((r) => r.location_type === 'AISLE' && r.capacity === 2)).toBe(true);
  });

  it('skips the slow occupancy read when the save deletes no rows', async () => {
    const mock = baseMock();
    const { updateSectionSize } = await loadServiceWith(mock);

    await updateSectionSize('zone-41', {
      zoneCode: '41', zoneName: 'ห้อง 41',
      leftConfig: { active: true, rows: 2 }, rightConfig: { active: false, rows: 0 },
      aisleConfig: { active: true, capacity: 2 },
      capacity: 12,
    });

    const tables = mock.supabase.from.mock.calls.map(([table]) => table);
    expect(tables).not.toContain('tgd_deposit_line_location_picked');
    expect(tables).not.toContain('tgd_customer_deposit_line_locations');
  });

  it('removes empty aisle slots only when the aisle is explicitly switched off', async () => {
    const mock = baseMock();
    const { updateSectionSize } = await loadServiceWith(mock);

    await updateSectionSize('zone-41', {
      zoneCode: '41', zoneName: 'ห้อง 41',
      leftConfig: { active: true, rows: 2 }, rightConfig: { active: false, rows: 0 },
      aisleConfig: { active: false, capacity: 2 },
      capacity: 12,
    });

    expect(mock.calls.deletes.flatMap((d) => d.ids).sort()).toEqual(['a1', 'a2']);
  });
});
