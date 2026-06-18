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

// Grid dimensions from location codes (format: PREFIX-RxxCxx)
function inferGrid(locations) {
  if (locations.length === 0) return { rows: 0, cols: 0 };
  const parsed = locations.map((l) => {
    const m = /R(\d+)C(\d+)$/i.exec(l.location_code ?? '');
    return m ? { r: +m[1], c: +m[2] } : null;
  }).filter(Boolean);
  if (parsed.length === locations.length && parsed.length > 0) {
    return {
      rows: Math.max(...parsed.map((p) => p.r)),
      cols: Math.max(...parsed.map((p) => p.c)),
    };
  }
  const cols = Math.min(12, Math.ceil(Math.sqrt(locations.length * 1.5)));
  return { rows: Math.ceil(locations.length / cols), cols };
}

export async function getSectionsWithOccupancy() {
  if (!supabase) return { data: [], error: null };

  const { data: zones, error } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, zone_name, is_active, tgd_rooms(id, tgd_locations(id, location_code))')
    .eq('is_active', true)
    .order('zone_code');

  if (error) return { data: [], error };

  const { data: stockRows } = await supabase
    .from('tgd_stock_balances')
    .select('location_id')
    .gt('qty_on_hand', 0);

  const occupiedSet = new Set((stockRows ?? []).map((s) => s.location_id).filter(Boolean));

  const sections = (zones ?? []).map((zone) => {
    const locations = (zone.tgd_rooms ?? []).flatMap((r) => r.tgd_locations ?? []);
    const total = locations.length;
    const used = locations.filter((l) => occupiedSet.has(l.id)).length;
    const { rows, cols } = inferGrid(locations);
    return {
      id: zone.id,
      code: zone.zone_code,
      name: zone.zone_name,
      rows,
      cols,
      total,
      used,
      empty: total - used,
      usedPct: total > 0 ? Math.round((used / total) * 100) : 0,
      locations: locations.map((l) => ({ ...l, isOccupied: occupiedSet.has(l.id) })),
    };
  });

  return { data: sections, error: null };
}

export async function getActiveLocations() {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, zone_name, tgd_rooms(id, tgd_locations(id, location_code, location_name, is_active))')
    .eq('is_active', true)
    .order('zone_code');

  if (error) return { data: [], error };

  const locations = (data ?? []).flatMap((zone) =>
    (zone.tgd_rooms ?? []).flatMap((room) =>
      (room.tgd_locations ?? [])
        .filter((l) => l.is_active)
        .map((l) => ({
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

export async function createSection({ warehouseId, zoneCode, zoneName, rows, cols }) {
  if (!supabase) return missing();

  const { data: zone, error: ze } = await supabase
    .from('tgd_zones')
    .insert({ warehouse_id: warehouseId, zone_code: zoneCode, zone_name: zoneName, temperature_type: 'COLD' })
    .select('id')
    .single();
  if (ze) return { error: ze };

  const { data: room, error: re } = await supabase
    .from('tgd_rooms')
    .insert({ zone_id: zone.id, room_code: 'R01', room_name: zoneName })
    .select('id')
    .single();
  if (re) return { error: re };

  const inserts = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      inserts.push({
        room_id: room.id,
        location_code: `${zoneCode}-R${String(r).padStart(2, '0')}C${String(c).padStart(2, '0')}`,
        location_name: `${zoneName} แถว${r} ช่อง${c}`,
        location_type: 'SHELF',
      });
    }
  }

  if (inserts.length > 0) {
    const { error: le } = await supabase.from('tgd_locations').insert(inserts);
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
