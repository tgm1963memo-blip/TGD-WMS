import { supabase } from './supabaseClient.js';
import { parseLocationCode, buildLocationCode, formatRowLabel } from '../utils/locationCodeUtils.js';

const DEFAULT_ROW_CAPACITY = 14;

function missing() {
  return { data: null, error: new Error('Supabase client not configured.') };
}

export async function ensureDefaultWarehouse() {
  if (!supabase) return missing();
  const { data } = await supabase
    .from('tgd_warehouses')
    .select('id, warehouse_code, warehouse_name')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (data) return { data, error: null };
  return supabase
    .from('tgd_warehouses')
    .insert({ warehouse_code: 'TGC001', warehouse_name: 'TG Cold Storage', warehouse_type: 'COLD' })
    .select('id, warehouse_code, warehouse_name')
    .single();
}

// Analyzes a zone's locations (now always {room}-{side}-{row}, see
// locationCodeUtils.js) into per-side row counts for the dashboard's
// 1-dimensional row list. A location that doesn't match the current format
// (shouldn't exist after the 20260905090000 consolidation migration, but
// defensive against a bad manual insert) is just excluded from the count
// rather than falling back to a legacy grid-shape guess -- there's no
// legacy shape left to guess at.
function analyzeLocations(locations) {
  if (!locations.length) return { rows: 0, sidesConfig: { L: { rows: 0 }, R: { rows: 0 } } };

  const parsed = locations.map((l) => parseLocationCode(l.location_code)).filter(Boolean);
  const sidesConfig = { L: { rows: 0 }, R: { rows: 0 } };
  for (const p of parsed) {
    if (sidesConfig[p.side]) sidesConfig[p.side].rows = Math.max(sidesConfig[p.side].rows, p.row);
  }
  const sides = [...new Set(parsed.map((p) => p.side))].sort();

  return { rows: sidesConfig.L.rows + sidesConfig.R.rows, numSides: sides.length, sides, sidesConfig };
}

function isUnknownColumnError(error) {
  return /column .* does not exist|Could not find .* column/i.test(error?.message ?? '');
}

function getMissingColumnName(error) {
  const message = error?.message ?? '';
  return /'([^']+)'\s+column/i.exec(message)?.[1] ?? /column "([^"]+)"/i.exec(message)?.[1] ?? null;
}

async function insertLocationsWithSchemaFallback(rows) {
  let candidateRows = rows;
  const removedColumns = new Set();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase.from('tgd_locations').insert(candidateRows);
    if (!isUnknownColumnError(error)) return { error };

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || removedColumns.has(missingColumn)) return { error };

    removedColumns.add(missingColumn);
    candidateRows = candidateRows.map((row) => {
      const { [missingColumn]: _removed, ...nextRow } = row;
      return nextRow;
    });
  }

  return { error: new Error('Unable to create locations because the live tgd_locations schema is not compatible.') };
}

export async function getSectionsWithOccupancy() {
  if (!supabase) return { data: [], error: null };

  const { data: zones, error } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, zone_name, temperature_type, is_active, tgd_rooms(id, tgd_locations(id, location_code, capacity))')
    .eq('is_active', true)
    .order('zone_code');

  if (error) return { data: [], error };

  // A row now holds several pallets, not one binary occupied/empty slot, so
  // occupancy is a COUNT of pallets in use per location, compared against
  // that location's capacity. tgd_customer_deposit_line_locations (one row
  // per pallet a line's stock was placed on) is the single source of truth
  // for this -- both the backfill from the pre-pallet-split model and every
  // new "add storage" action write to it, so it always reflects reality
  // without needing the old dual tgd_stock_balances/deposit-line fallback.
  const [{ data: allocations }, { data: picks }] = await Promise.all([
    supabase.from('tgd_customer_deposit_line_locations').select('id, location_id, boxes'),
    supabase.from('tgd_customer_withdrawal_line_pallet_picks').select('deposit_line_location_id, boxes'),
  ]);

  const pickedByAllocationId = new Map();
  for (const p of picks ?? []) {
    if (!p.deposit_line_location_id) continue;
    pickedByAllocationId.set(
      p.deposit_line_location_id,
      (pickedByAllocationId.get(p.deposit_line_location_id) ?? 0) + Number(p.boxes || 0)
    );
  }

  const usedCountMap = new Map();
  for (const a of allocations ?? []) {
    if (!a.location_id) continue;
    // A pallet with a known box count that's been fully picked out no
    // longer occupies a slot; one with no box count at all (weight-only
    // receipts) is conservatively always counted as occupied.
    const remaining = a.boxes == null ? 1 : Number(a.boxes) - (pickedByAllocationId.get(a.id) ?? 0);
    if (remaining > 0) {
      usedCountMap.set(a.location_id, (usedCountMap.get(a.location_id) ?? 0) + 1);
    }
  }

  const sections = (zones ?? []).map((zone) => {
    const locations = (zone.tgd_rooms ?? []).flatMap((r) => r.tgd_locations ?? []);
    const total = locations.length;
    const totalCapacity = locations.reduce((sum, l) => sum + (Number(l.capacity) || 0), 0);
    const used = locations.reduce((sum, l) => sum + (usedCountMap.get(l.id) ?? 0), 0);
    const gridInfo = analyzeLocations(locations);
    return {
      id: zone.id,
      code: zone.zone_code,
      name: zone.zone_name,
      temperatureType: zone.temperature_type ?? null,
      gridInfo,
      rows: gridInfo.rows,
      total,
      totalCapacity,
      used,
      empty: Math.max(0, totalCapacity - used),
      usedPct: totalCapacity > 0 ? Number(((used / totalCapacity) * 100).toFixed(2)) : 0,
      locations: locations.map((l) => ({
        ...l,
        capacity: Number(l.capacity) || 0,
        usedCount: usedCountMap.get(l.id) ?? 0,
        isOccupied: (usedCountMap.get(l.id) ?? 0) > 0,
      })),
    };
  });

  return { data: sections, error: null };
}

// Per-pallet breakdown of one location's row -- drives the dashboard's
// "click a row" drill-down (see WarehouseLayoutWidget.jsx), which now shows
// which pallet slot holds what instead of a flat stock list. A pallet only
// shows up here while it still holds unpicked stock (or has an unknown/
// weight-only quantity, which is conservatively treated as occupied) --
// the caller fills in the remaining 1..capacity slots as empty.
export async function getPalletDetailsAtLocation(locationId) {
  if (!supabase || !locationId) return { data: { capacity: 0, pallets: [] }, error: null };

  const { data: locationRow } = await supabase
    .from('tgd_locations')
    .select('capacity')
    .eq('id', locationId)
    .maybeSingle();
  const capacity = Number(locationRow?.capacity) || 0;

  const { data: allocations, error } = await supabase
    .from('tgd_customer_deposit_line_locations')
    .select(`
      id, pallet_no, boxes, weight, line_id,
      tgd_customer_deposit_request_lines(tracking_code, product_name, customer_product_code)
    `)
    .eq('location_id', locationId)
    .order('pallet_no', { ascending: true });

  if (error) return { data: { capacity, pallets: [] }, error };

  const allocationIds = (allocations ?? []).map((a) => a.id);
  const pickedByAllocationId = new Map();
  if (allocationIds.length > 0) {
    const { data: picks } = await supabase
      .from('tgd_customer_withdrawal_line_pallet_picks')
      .select('deposit_line_location_id, boxes')
      .in('deposit_line_location_id', allocationIds);
    for (const p of picks ?? []) {
      pickedByAllocationId.set(
        p.deposit_line_location_id,
        (pickedByAllocationId.get(p.deposit_line_location_id) ?? 0) + Number(p.boxes || 0)
      );
    }
  }

  const pallets = (allocations ?? [])
    .map((a) => {
      const picked = pickedByAllocationId.get(a.id) ?? 0;
      const remainingBoxes = a.boxes != null ? Math.max(0, Number(a.boxes) - picked) : null;
      return {
        allocationId: a.id,
        palletNo: a.pallet_no,
        boxes: a.boxes,
        weight: a.weight,
        remainingBoxes,
        lineId: a.line_id,
        trackingCode: a.tgd_customer_deposit_request_lines?.tracking_code ?? null,
        productName: a.tgd_customer_deposit_request_lines?.product_name ?? null,
        customerProductCode: a.tgd_customer_deposit_request_lines?.customer_product_code ?? null,
      };
    })
    .filter((p) => p.remainingBoxes == null || p.remainingBoxes > 0);

  return { data: { capacity, pallets }, error: null };
}

export async function getActiveLocations() {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, zone_name, tgd_rooms(id, tgd_locations(id, location_code, location_name))')
    .neq('is_active', false)
    .order('zone_code');

  if (error) return { data: [], error };

  const locations = (data ?? []).flatMap((zone) =>
    (zone.tgd_rooms ?? []).flatMap((room) =>
      (room.tgd_locations ?? []).map((l) => ({
        id: l.id,
        code: l.location_code,
        name: l.location_name ?? l.location_code,
        sectionCode: zone.zone_code,
        sectionName: zone.zone_name,
        label: `${zone.zone_code} · ${l.location_code}`,
      }))
    )
  );

  return { data: locations, error: null };
}

// sides: array of 'L' | 'R' | both
// Location code format: {roomCode}-{side}-{row:02d}  e.g. H1-L-01 -- one
// location per row now (see locationCodeUtils.js); capacity is a single
// pallets-per-row figure applied to every row created for this zone.
export async function createSection({ warehouseId, zoneCode, zoneName, temperatureType, leftConfig, rightConfig, capacity }) {
  if (!supabase) return missing();

  let { data: zone, error: ze } = await supabase
    .from('tgd_zones')
    .insert({
      warehouse_id: warehouseId,
      name: zoneName,
      zone_code: zoneCode,
      zone_name: zoneName,
      temperature_type: temperatureType ?? 'FROZEN',
    })
    .select('id')
    .single();
  if (isUnknownColumnError(ze)) {
    const retry = await supabase
      .from('tgd_zones')
      .insert({
        warehouse_id: warehouseId,
        zone_code: zoneCode,
        zone_name: zoneName,
        temperature_type: temperatureType ?? 'FROZEN',
      })
      .select('id')
      .single();
    zone = retry.data;
    ze = retry.error;
  }
  if (ze) return { error: ze };

  const { data: room, error: re } = await supabase
    .from('tgd_rooms')
    .insert({ zone_id: zone.id, room_code: 'R01', room_name: zoneName })
    .select('id')
    .single();
  if (re) return { error: re };

  const sideNames = { L: 'ซ้าย', R: 'ขวา' };
  const rowCapacity = Number(capacity) || DEFAULT_ROW_CAPACITY;
  const inserts = [];

  const addSideLocations = (side, config) => {
    if (!config?.active) return;
    // Row 0 is the "รอจ่าย" staging row convention (see locationCodeUtils.js's
    // formatRowLabel) -- a real row in every other respect, just created
    // alongside 1..rows instead of counted as one of them.
    const startRow = config.staging ? 0 : 1;
    for (let r = startRow; r <= config.rows; r++) {
      const code = buildLocationCode(zoneCode, side, r);
      inserts.push({
        room_id: room.id,
        zone_id: zone.id,
        name: code,
        location_code: code,
        location_name: `${zoneName} ฝั่ง${sideNames[side] ?? side} ${formatRowLabel(r)}`,
        location_type: 'SHELF',
        capacity: rowCapacity,
      });
    }
  };

  addSideLocations('L', leftConfig);
  addSideLocations('R', rightConfig);

  if (inserts.length > 0) {
    const { error: le } = await insertLocationsWithSchemaFallback(inserts);
    if (le) return { error: le };
  }

  return { data: zone, error: null };
}

export async function updateSectionSize(zoneId, { zoneCode, zoneName, leftConfig, rightConfig, capacity }) {
  if (!supabase) return missing();

  const { data: rooms, error: roomErr } = await supabase
    .from('tgd_rooms').select('id').eq('zone_id', zoneId);
  if (roomErr) return { error: roomErr };
  const roomId = rooms?.[0]?.id;
  if (!roomId) return { error: new Error('ไม่พบห้องสำหรับ zone นี้') };

  const { data: existingLocs, error: locErr } = await supabase
    .from('tgd_locations').select('id, location_code').eq('zone_id', zoneId);
  if (locErr) return { error: locErr };

  const existingMap = new Map((existingLocs ?? []).map((l) => [l.location_code, l]));
  const existingCodes = new Set(existingMap.keys());

  let occupiedIds = new Set();
  const locIds = (existingLocs ?? []).map((l) => l.id);
  if (locIds.length > 0) {
    const { data: stockRows } = await supabase
      .from('tgd_stock_balances').select('location_id').in('location_id', locIds).gt('qty_on_hand', 0);
    occupiedIds = new Set((stockRows ?? []).map((s) => s.location_id));

    // Same gap fixed elsewhere for the dashboard (tgd_stock_balances isn't
    // updated by the handheld "Update Location" flow) -- without this, a
    // row that's actually holding pallets only tracked via deposit lines
    // could look "empty" here and get deleted out from under real stock.
    const { data: depositLineRows } = await supabase
      .from('tgd_customer_deposit_request_lines')
      .select('location_id')
      .in('location_id', locIds)
      .or('actual_boxes.gt.0,actual_weight.gt.0');
    for (const line of depositLineRows ?? []) occupiedIds.add(line.location_id);
  }

  const sideNames = { L: 'ซ้าย', R: 'ขวา' };
  const rowCapacity = Number(capacity) || DEFAULT_ROW_CAPACITY;
  const desiredCodes = new Set();
  const toInsertRows = [];

  const addSide = (side, config) => {
    if (!config?.active) return;
    const startRow = config.staging ? 0 : 1;
    for (let r = startRow; r <= config.rows; r++) {
      const code = buildLocationCode(zoneCode, side, r);
      desiredCodes.add(code);
      if (!existingCodes.has(code)) {
        toInsertRows.push({
          room_id: roomId,
          zone_id: zoneId,
          name: code,
          location_code: code,
          location_name: `${zoneName} ฝั่ง${sideNames[side] ?? side} ${formatRowLabel(r)}`,
          location_type: 'SHELF',
          capacity: rowCapacity,
        });
      }
    }
  };

  addSide('L', leftConfig);
  addSide('R', rightConfig);

  const toDeleteCodes = [...existingCodes].filter((code) => !desiredCodes.has(code));
  const occupiedToDelete = toDeleteCodes.filter((code) => {
    const loc = existingMap.get(code);
    return loc && occupiedIds.has(loc.id);
  });

  if (occupiedToDelete.length > 0) {
    return { error: new Error(`ไม่สามารถลด Location ได้ มี ${occupiedToDelete.length} Location ที่มีสินค้าอยู่`) };
  }

  if (toDeleteCodes.length > 0) {
    const idsToDelete = toDeleteCodes.map((code) => existingMap.get(code)?.id).filter(Boolean);
    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase.from('tgd_locations').delete().in('id', idsToDelete);
      if (delErr) return { error: delErr };
    }
  }

  // Apply a changed capacity to every row this zone already has too, not
  // just newly-inserted ones -- otherwise adjusting it later would only
  // ever affect rows added after that point.
  if (locIds.length > 0) {
    const { error: capErr } = await supabase.from('tgd_locations').update({ capacity: rowCapacity }).in('id', locIds);
    if (capErr) return { error: capErr };
  }

  if (toInsertRows.length > 0) {
    const { error: insErr } = await insertLocationsWithSchemaFallback(toInsertRows);
    if (insErr) return { error: insErr };
  }

  return { data: { added: toInsertRows.length, removed: toDeleteCodes.length }, error: null };
}

export async function deleteSection(zoneId) {
  if (!supabase) return missing();
  const { data: rooms } = await supabase.from('tgd_rooms').select('id').eq('zone_id', zoneId);
  const roomIds = (rooms ?? []).map((r) => r.id);
  if (roomIds.length > 0) {
    await supabase.from('tgd_locations').delete().in('room_id', roomIds);
    await supabase.from('tgd_rooms').delete().in('id', roomIds);
  }
  return supabase.from('tgd_zones').delete().eq('id', zoneId);
}
