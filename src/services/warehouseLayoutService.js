import { supabase } from './supabaseClient.js';
import { parseLocationCode, buildLocationCode } from '../utils/locationCodeUtils.js';

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

  const { data: stockRows } = await supabase
    .from('tgd_stock_balances')
    .select('location_id, qty_on_hand, qty_allocated')
    .gt('qty_on_hand', 0);

  // A row now holds several pallets, not one binary occupied/empty slot, so
  // occupancy is a COUNT per location (one qualifying row ≈ one pallet) that
  // gets compared against that location's capacity, not a plain Set of
  // "has stock" membership like before.
  const usedCountMap = new Map();
  for (const s of stockRows ?? []) {
    if (s.location_id && (Number(s.qty_on_hand || 0) - Number(s.qty_allocated || 0)) > 0) {
      usedCountMap.set(s.location_id, (usedCountMap.get(s.location_id) ?? 0) + 1);
    }
  }
  const locationIdsWithStockBalance = new Set(usedCountMap.keys());

  // tgd_stock_balances isn't updated when a deposit line's location is set
  // or changed via the handheld "Update Location" scan flow (that RPC only
  // ever writes tgd_customer_deposit_request_lines.location_id) -- without
  // this, a location just assigned there via a scan keeps showing as empty
  // on this map until/unless something else independently creates a
  // matching stock_balances row. Same fallback checkLocationHasInventory
  // already uses to avoid warning "location free" for one of these. Only
  // counted for a location with NO stock_balances rows at all (matching
  // getStockAtLocation's own fallback), so the same physical stock is never
  // counted from both sources at once.
  const { data: depositLineRows } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('location_id, actual_boxes, actual_weight')
    .not('location_id', 'is', null)
    .or('actual_boxes.gt.0,actual_weight.gt.0');

  for (const line of depositLineRows ?? []) {
    if (!line.location_id || locationIdsWithStockBalance.has(line.location_id)) continue;
    usedCountMap.set(line.location_id, (usedCountMap.get(line.location_id) ?? 0) + 1);
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

// Nothing links a tgd_stock_balances row back to the deposit line that put
// it there (last_movement_id is frequently null, and even when set doesn't
// always carry a source_line_id) -- so tracking_code/customer_product_code
// aren't derivable from stock_balances alone. Best-effort recovers them by
// matching the deposit line(s) at the same location for the same customer,
// preferring the most recently received one. Not a guaranteed-correct join
// when one customer has several lots sharing a row, but strictly additive
// display info -- never affects quantities or availability.
async function attachDepositLineDetails(locationId, items) {
  const customerIds = [...new Set(items.map((i) => i.customer_id).filter(Boolean))];
  if (!customerIds.length) return items;

  const { data: depositLines } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('product_name, customer_product_code, tracking_code, created_at, tgd_customer_deposit_requests(customer_id)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  const byCustomer = new Map();
  for (const line of depositLines ?? []) {
    const cid = line.tgd_customer_deposit_requests?.customer_id;
    if (cid && !byCustomer.has(cid)) byCustomer.set(cid, line);
  }

  return items.map((item) => {
    const match = byCustomer.get(item.customer_id);
    if (!match) return item;
    return {
      ...item,
      matched_product_name: match.product_name ?? null,
      matched_product_code: match.customer_product_code ?? null,
      tracking_code: match.tracking_code ?? null,
    };
  });
}

export async function getStockAtLocation(locationId) {
  if (!supabase || !locationId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tgd_stock_balances')
    .select('id, qty_on_hand, qty_allocated, uom, weight, customer_id, product_id, lot_id, pallet_id, tgd_lots(lot_number, expiry_date)')
    .eq('location_id', locationId)
    .gt('qty_on_hand', 0);

  if (error) {
    console.error('Failed to fetch stock at location:', error);
  }

  if (data && data.length > 0) {
    return { data: await attachDepositLineDetails(locationId, data), error };
  }

  // No tgd_stock_balances row here -- same gap getSectionsWithOccupancy
  // works around (see its comment): fall back to deposit lines actually
  // received at this location, so a location the map now marks occupied
  // (via that same fallback) isn't shown as empty the moment someone
  // clicks it. Only used when stock_balances had nothing, so a location
  // genuinely tracked there isn't ever listed twice.
  const { data: depositLines, error: depositError } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, actual_boxes, actual_weight, uom, lot_no, exp_date, product_id, product_name, customer_product_code, tracking_code, tgd_customer_deposit_requests(customer_id)')
    .eq('location_id', locationId)
    .or('actual_boxes.gt.0,actual_weight.gt.0');

  if (depositError) {
    console.error('Failed to fetch deposit lines at location:', depositError);
    return { data: data ?? [], error };
  }

  const mapped = (depositLines ?? []).map((line) => ({
    id: `dep-${line.id}`,
    qty_on_hand: Number(line.actual_boxes ?? 0),
    qty_allocated: 0,
    uom: line.uom || 'กล่อง',
    weight: line.actual_weight != null ? Number(line.actual_weight) : null,
    customer_id: line.tgd_customer_deposit_requests?.customer_id ?? null,
    product_id: line.product_id ?? null,
    product_name: line.product_name ?? line.customer_product_code ?? null,
    matched_product_name: line.product_name ?? null,
    matched_product_code: line.customer_product_code ?? null,
    tracking_code: line.tracking_code ?? null,
    lot_id: null,
    pallet_id: null,
    tgd_lots: (line.lot_no || line.exp_date) ? { lot_number: line.lot_no ?? null, expiry_date: line.exp_date ?? null } : null,
  }));

  return { data: mapped, error: null };
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
    for (let r = 1; r <= config.rows; r++) {
      const code = buildLocationCode(zoneCode, side, r);
      inserts.push({
        room_id: room.id,
        zone_id: zone.id,
        name: code,
        location_code: code,
        location_name: `${zoneName} ฝั่ง${sideNames[side] ?? side} แถว${r}`,
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
    for (let r = 1; r <= config.rows; r++) {
      const code = buildLocationCode(zoneCode, side, r);
      desiredCodes.add(code);
      if (!existingCodes.has(code)) {
        toInsertRows.push({
          room_id: roomId,
          zone_id: zoneId,
          name: code,
          location_code: code,
          location_name: `${zoneName} ฝั่ง${sideNames[side] ?? side} แถว${r}`,
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
