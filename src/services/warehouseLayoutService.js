import { supabase } from './supabaseClient.js';
import { parseLocationCode, buildLocationCode, formatRowLabel } from '../utils/locationCodeUtils.js';

// Standard max pallets/row per the warehouse's own operating rule -- rows
// created without an explicit capacity fall back to this. A row can still
// exceed it in practice (see tgd_add_deposit_line_location_allocation's
// pallet_over_capacity warning, non-blocking) -- this is just the default.
// Exported so the dashboard can flag a row as over the warehouse's real
// standard even when its own `capacity` column was raised above 16 to match
// a pre-existing historical count (see the 20260915090000 backfill) --
// those rows are still over the normal rule, just no longer over their own
// (adjusted) capacity field.
export const DEFAULT_ROW_CAPACITY = 16;

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

// Sums picked boxes per deposit_line_location_id (pallet allocation) --
// shared by every caller that needs "how much of this pallet has already
// been picked out": getSectionsWithOccupancy and getPalletDetailsAtLocation
// below, and listPickablePalletsForDepositLine in
// customerWithdrawalRequestService.js (which imports this rather than
// re-querying/re-summing the same rows itself). Pass a specific list of
// allocation ids to scope the query (e.g. to one location's pallets);
// omit it to sum across every allocation in the warehouse.
export async function getPickedBoxesByAllocationId(allocationIds = null) {
  const pickedByAllocationId = new Map();
  if (!supabase) return pickedByAllocationId;
  if (allocationIds && allocationIds.length === 0) return pickedByAllocationId;

  let query = supabase.from('tgd_customer_withdrawal_line_pallet_picks').select('deposit_line_location_id, boxes');
  if (allocationIds) query = query.in('deposit_line_location_id', allocationIds);
  const { data: picks } = await query;

  for (const p of picks ?? []) {
    if (!p.deposit_line_location_id) continue;
    pickedByAllocationId.set(
      p.deposit_line_location_id,
      (pickedByAllocationId.get(p.deposit_line_location_id) ?? 0) + Number(p.boxes || 0)
    );
  }
  return pickedByAllocationId;
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
  // occupancy is a COUNT of pallet SLOTS in use per location, compared
  // against that location's capacity. tgd_customer_deposit_line_locations
  // (one row per pallet a line's stock was placed on) is the single source
  // of truth for this -- both the backfill from the pre-pallet-split model
  // and every new "add storage" action write to it, so it always reflects
  // reality without needing the old dual tgd_stock_balances/deposit-line
  // fallback.
  const [{ data: allocations }, pickedByAllocationId] = await Promise.all([
    supabase.from('tgd_customer_deposit_line_locations').select('id, location_id, pallet_no, boxes'),
    getPickedBoxesByAllocationId(),
  ]);

  // Count DISTINCT pallet numbers with remaining stock, not allocation rows
  // -- a pallet slot can now hold more than one tracking code (duplicate
  // pallet assignment is a non-blocking warning, not an error, see
  // tgd_add_deposit_line_location_allocation), so two allocations sharing
  // the same physical pallet must still only count as ONE used slot, not
  // two. Confirmed real gap: a row with e.g. 3 tracking codes crammed onto
  // 1 pallet showed as "3/12 used" on the dashboard instead of "1/12".
  const activePalletsByLocation = new Map();
  for (const a of allocations ?? []) {
    if (!a.location_id) continue;
    // A pallet with a known box count that's been fully picked out no
    // longer occupies a slot; one with no box count at all (weight-only
    // receipts) is conservatively always counted as occupied.
    const remaining = a.boxes == null ? 1 : Number(a.boxes) - (pickedByAllocationId.get(a.id) ?? 0);
    if (remaining > 0) {
      const palletSet = activePalletsByLocation.get(a.location_id) ?? new Set();
      palletSet.add(a.pallet_no);
      activePalletsByLocation.set(a.location_id, palletSet);
    }
  }
  const usedCountMap = new Map();
  for (const [locationId, palletSet] of activePalletsByLocation) {
    usedCountMap.set(locationId, palletSet.size);
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
  const pickedByAllocationId = await getPickedBoxesByAllocationId(allocationIds);

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

// Turns a getPalletDetailsAtLocation() result into "which pallet numbers
// are free, and which one should be pre-selected" -- shared by every "add
// storage" UI (ReceivingWorkflow/LocationUpdateWorkflow in HandheldPage.jsx,
// CustomerDepositDetailModal.jsx) so each doesn't re-derive the same
// capacity-minus-taken/first-free-slot loop by hand.
export function resolvePalletSlotState(palletDetails) {
  const capacity = palletDetails?.capacity ?? 0;
  const taken = new Set((palletDetails?.pallets ?? []).map((p) => p.palletNo));
  let firstFree = '';
  for (let n = 1; n <= capacity; n += 1) {
    if (!taken.has(n)) { firstFree = String(n); break; }
  }
  return { capacity, taken, firstFree };
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

  const locIds = (existingLocs ?? []).map((l) => l.id);
  // Real, pallet-split-aware occupancy (see getOccupiedPalletCountByLocationId)
  // -- this used to check tgd_stock_balances/tgd_customer_deposit_request_lines.
  // location_id directly, both stale since the pallet-split migration: a
  // deposit line's location_id is now only a "most recently added" pointer,
  // not the source of truth once it has multiple pallet allocations, so a
  // row holding real stock under an allocation that ISN'T that pointer could
  // silently look empty and get shrunk/deleted out from under it.
  const occupiedPalletCountById = locIds.length > 0
    ? await getOccupiedPalletCountByLocationId(locIds)
    : new Map();

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
    return loc && (occupiedPalletCountById.get(loc.id) ?? 0) > 0;
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

// Which of the given location ids currently hold at least one pallet with
// remaining stock -- the real, pallet-split-aware occupancy check (built on
// getPickedBoxesByAllocationId above), used anywhere a single location row
// might be deleted or shrunk so a row still holding real stock can't be
// silently removed out from under it. Mirrors getSectionsWithOccupancy's own
// usedCountMap computation, just scoped to specific location ids instead of
// every location in the warehouse. Returns Map<locationId, remaining pallet
// count>; a location absent from the map has nothing left in it.
export async function getOccupiedPalletCountByLocationId(locationIds) {
  const result = new Map();
  if (!supabase || !locationIds || locationIds.length === 0) return result;

  const { data: allocations } = await supabase
    .from('tgd_customer_deposit_line_locations')
    .select('id, location_id, boxes')
    .in('location_id', locationIds);

  const allocationIds = (allocations ?? []).map((a) => a.id);
  const pickedByAllocationId = await getPickedBoxesByAllocationId(allocationIds);

  for (const a of allocations ?? []) {
    const remaining = a.boxes == null ? 1 : Number(a.boxes) - (pickedByAllocationId.get(a.id) ?? 0);
    if (remaining > 0) {
      result.set(a.location_id, (result.get(a.location_id) ?? 0) + 1);
    }
  }
  return result;
}

// Deletes exactly ONE location row -- unlike deleteSection above (which
// wipes an entire zone's rooms/locations at once), this leaves every other
// row in the zone untouched. Blocked if the row still holds any pallet with
// remaining stock (see getOccupiedPalletCountByLocationId) -- staff must
// cancel/move that stock out first (the existing "ยกเลิก" allocation flow)
// before a row can be removed.
export async function deleteLocation(locationId) {
  if (!supabase || !locationId) return missing();

  const occupiedCountById = await getOccupiedPalletCountByLocationId([locationId]);
  const occupiedCount = occupiedCountById.get(locationId) ?? 0;
  if (occupiedCount > 0) {
    return { error: new Error(`ลบไม่ได้ Location นี้มีสินค้าอยู่ ${occupiedCount} pallet — ย้าย/ยกเลิกการจัดเก็บออกก่อน`) };
  }

  const { error } = await supabase.from('tgd_locations').delete().eq('id', locationId);
  return { error };
}

// Edits exactly ONE location row -- its capacity and/or its own room/side/
// row identity (i.e. moving 41-L-05 to become 42-R-03). Renaming is allowed
// even while the row holds stock: every allocation references the location
// by its stable UUID (tgd_customer_deposit_line_locations.location_id), not
// by the location_code text, so changing the code can never orphan existing
// stock. Shrinking capacity below what's actually in use IS blocked, same
// reasoning as updateSectionSize's occupied-row guard above.
export async function updateLocation(locationId, { capacity, zoneCode, side, row } = {}) {
  if (!supabase || !locationId) return missing();

  const { data: current, error: fetchErr } = await supabase
    .from('tgd_locations')
    .select('id, zone_id, room_id, location_code, location_name, capacity')
    .eq('id', locationId)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr };
  if (!current) return { error: new Error('ไม่พบ Location นี้') };

  const nextCapacity = capacity != null ? Number(capacity) || DEFAULT_ROW_CAPACITY : current.capacity;

  if (capacity != null) {
    const occupiedCountById = await getOccupiedPalletCountByLocationId([locationId]);
    const occupiedCount = occupiedCountById.get(locationId) ?? 0;
    if (nextCapacity < occupiedCount) {
      return { error: new Error(`ลดความจุไม่ได้ Location นี้มีสินค้าอยู่ ${occupiedCount} pallet`) };
    }
  }

  const updates = { capacity: nextCapacity };

  if (zoneCode != null && side != null && row != null) {
    const newCode = buildLocationCode(zoneCode, side, row);
    if (newCode !== current.location_code) {
      const { data: collision } = await supabase
        .from('tgd_locations')
        .select('id')
        .eq('location_code', newCode)
        .neq('id', locationId)
        .maybeSingle();
      if (collision) {
        return { error: new Error(`รหัส Location "${newCode}" มีอยู่แล้ว`) };
      }

      // Moving to a different ROOM (e.g. 41-L-05 -> 42-R-03) needs its own
      // zone_id/room_id, not just a new code string -- getSectionsWithOccupancy
      // groups locations by these real FKs (via tgd_rooms -> tgd_zones), so a
      // location whose code says "42-..." but whose zone_id/room_id still
      // point at zone 41 would keep showing up under the WRONG room's card.
      // Every zone has exactly one room today (see createSection's single
      // 'R01' room per zone), so resolving the target zone's id is enough to
      // also resolve which room to move into.
      const { data: targetZone, error: zoneErr } = await supabase
        .from('tgd_zones')
        .select('id, zone_name')
        .eq('zone_code', zoneCode)
        .maybeSingle();
      if (zoneErr) return { error: zoneErr };
      if (!targetZone) return { error: new Error(`ไม่พบห้อง "${zoneCode}" ในระบบ`) };

      let targetRoomId = current.room_id;
      if (targetZone.id !== current.zone_id) {
        const { data: targetRoom, error: roomErr } = await supabase
          .from('tgd_rooms')
          .select('id')
          .eq('zone_id', targetZone.id)
          .limit(1)
          .maybeSingle();
        if (roomErr) return { error: roomErr };
        if (!targetRoom) return { error: new Error(`ห้อง "${zoneCode}" ยังไม่มีข้อมูล room`) };
        targetRoomId = targetRoom.id;
      }

      const sideNames = { L: 'ซ้าย', R: 'ขวา' };
      updates.location_code = newCode;
      updates.name = newCode;
      updates.location_name = `${targetZone.zone_name} ฝั่ง${sideNames[side] ?? side} ${formatRowLabel(Number(row))}`;
      updates.zone_id = targetZone.id;
      updates.room_id = targetRoomId;
    }
  }

  const { error } = await supabase.from('tgd_locations').update(updates).eq('id', locationId);
  return { error };
}
