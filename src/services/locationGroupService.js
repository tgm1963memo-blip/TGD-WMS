import { supabase } from './supabaseClient.js';

// Every room's zones (tgd_location_groups) with the room's zone_code, for
// location pickers that let staff pick a zone before a row. Zones are labels
// only, so any failed read returns [] and the pickers work as before.
export async function getLocationGroups() {
  if (!supabase) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('tgd_location_groups')
      .select('id, zone_id, name, color, side, row_from, row_to, sort_order, tgd_zones(zone_code)')
      .order('sort_order');
    if (error) return { data: [], error };
    return {
      data: (data ?? []).map((g) => ({ ...g, zone_code: g.tgd_zones?.zone_code ?? null })),
      error: null,
    };
  } catch (error) {
    return { data: [], error };
  }
}
