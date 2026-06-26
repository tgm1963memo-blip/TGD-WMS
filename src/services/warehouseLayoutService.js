import { supabase } from './supabaseClient.js';

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

// New format: {RoomCode}-{L|R}-{Row:02d}-{Level:02d}  e.g. H1-L-01-03
function parseNewCode(code) {
  const m = /^(.+)-([LR])-(\d+)-(\d+)$/i.exec(code ?? '');
  return m ? { room: m[1], side: m[2].toUpperCase(), row: +m[3], level: +m[4] } : null;
}

// Legacy format: PREFIX-RxxCxx  e.g. S001-R01C01
function parseOldCode(code) {
  const m = /R(\d+)C(\d+)$/i.exec(code ?? '');
  return m ? { row: +m[1], col: +m[2] } : null;
}

// Legacy v2 format: PREFIX-{Row:02d}{L|R}-{Level:02d}  e.g. S001-01L-03
function parseMidCode(code) {
  const m = /(\d+)([LR])-(\d+)$/i.exec(code ?? '');
  return m ? { row: +m[1], side: m[2].toUpperCase(), level: +m[3] } : null;
}

// Analyze location codes to return structured grid info
function analyzeLocations(locations) {
  if (!locations.length) return { type: 'empty', rows: 0, cols: 0 };

  const newParsed = locations.map((l) => parseNewCode(l.location_code)).filter(Boolean);
  if (newParsed.length === locations.length) {
    const numRows = Math.max(...newParsed.map((p) => p.row));
    const sides = [...new Set(newParsed.map((p) => p.side))].sort();
    const numLevels = Math.max(...newParsed.map((p) => p.level));
    
    const sidesConfig = { L: { rows: 0, levels: 0 }, R: { rows: 0, levels: 0 } };
    newParsed.forEach(p => {
      if (sidesConfig[p.side]) {
        sidesConfig[p.side].rows = Math.max(sidesConfig[p.side].rows, p.row);
        sidesConfig[p.side].levels = Math.max(sidesConfig[p.side].levels, p.level);
      }
    });

    return {
      type: 'new',
      numRows,
      numSides: sides.length,
      sides,
      numLevels,
      sidesConfig,
      rows: numRows * sides.length,
      cols: numLevels,
    };
  }

  const midParsed = locations.map((l) => parseMidCode(l.location_code)).filter(Boolean);
  if (midParsed.length === locations.length) {
    const numRows = Math.max(...midParsed.map((p) => p.row));
    const sides = [...new Set(midParsed.map((p) => p.side))].sort();
    const numLevels = Math.max(...midParsed.map((p) => p.level));
    
    const sidesConfig = { L: { rows: 0, levels: 0 }, R: { rows: 0, levels: 0 } };
    midParsed.forEach(p => {
      if (sidesConfig[p.side]) {
        sidesConfig[p.side].rows = Math.max(sidesConfig[p.side].rows, p.row);
        sidesConfig[p.side].levels = Math.max(sidesConfig[p.side].levels, p.level);
      }
    });

    return { type: 'new', numRows, numSides: sides.length, sides, numLevels, sidesConfig, rows: numRows * sides.length, cols: numLevels };
  }

  const oldParsed = locations.map((l) => parseOldCode(l.location_code)).filter(Boolean);
  if (oldParsed.length === locations.length && oldParsed.length > 0) {
    return { type: 'old', rows: Math.max(...oldParsed.map((p) => p.row)), cols: Math.max(...oldParsed.map((p) => p.col)) };
  }

  const cols = Math.min(12, Math.ceil(Math.sqrt(locations.length * 1.5)));
  return { type: 'unknown', rows: Math.ceil(locations.length / cols), cols };
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
    .select('id, zone_code, zone_name, temperature_type, is_active, tgd_rooms(id, tgd_locations(id, location_code))')
    .eq('is_active', true)
    .order('zone_code');

  if (error) return { data: [], error };

  const { data: stockRows } = await supabase
    .from('tgd_stock_balances')
    .select('location_id, qty_on_hand, qty_allocated')
    .gt('qty_on_hand', 0);

  const occupiedSet = new Set(
    (stockRows ?? [])
      .filter((s) => s.location_id && (Number(s.qty_on_hand || 0) - Number(s.qty_allocated || 0)) > 0)
      .map((s) => s.location_id)
  );

  const sections = (zones ?? []).map((zone) => {
    const locations = (zone.tgd_rooms ?? []).flatMap((r) => r.tgd_locations ?? []);
    const total = locations.length;
    const used = locations.filter((l) => occupiedSet.has(l.id)).length;
    const gridInfo = analyzeLocations(locations);
    return {
      id: zone.id,
      code: zone.zone_code,
      name: zone.zone_name,
      temperatureType: zone.temperature_type ?? null,
      gridInfo,
      rows: gridInfo.rows,
      cols: gridInfo.cols,
      total,
      used,
      empty: total - used,
      usedPct: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0,
      locations: locations.map((l) => ({ ...l, isOccupied: occupiedSet.has(l.id) })),
    };
  });

  return { data: sections, error: null };
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

  return { data: data ?? [], error };
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
// Location code format: {roomCode}-{side}-{row:02d}-{level:02d}  e.g. H1-L-01-03
export async function createSection({ warehouseId, zoneCode, zoneName, temperatureType, leftConfig, rightConfig }) {
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
  const inserts = [];

  const addSideLocations = (side, config) => {
    if (!config?.active) return;
    for (let r = 1; r <= config.rows; r++) {
      for (let lv = 1; lv <= config.levels; lv++) {
        const rowStr = String(r).padStart(2, '0');
        const lvStr = String(lv).padStart(2, '0');
        inserts.push({
          room_id: room.id,
          zone_id: zone.id,
          name: `${zoneCode}-${side}-${rowStr}-${lvStr}`,
          location_code: `${zoneCode}-${side}-${rowStr}-${lvStr}`,
          location_name: `${zoneName} ฝั่ง${sideNames[side] ?? side} แถว${r} ชั้น${lv}`,
          location_type: 'SHELF',
        });
      }
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
