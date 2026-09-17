import { supabase } from './supabaseClient.js';
import { buildPalletCode } from '../utils/locationCodeUtils.js';

export const canManageInventoryLocation = (role) => ['admin', 'warehouse_admin', 'warehouse_manager'].includes(role);
const PAGE_SIZE = 1000;

async function collect(query) {
  const result = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return result;
  }
}

async function readAllocations(field, ids) {
  if (!supabase) throw new Error('Supabase client is not configured');
  const rows = [];
  const uniqueIds = [...new Set(ids)];
  for (let start = 0; start < uniqueIds.length; start += 150) {
    rows.push(...await collect(() => supabase.from('tgd_customer_deposit_line_locations')
      .select('id, line_id, location_id, pallet_no, boxes, weight, tgd_locations(location_code)')
      .in(field, uniqueIds.slice(start, start + 150))));
  }
  const picked = new Map();
  for (let start = 0; start < rows.length; start += 150) {
    const picks = await collect(() => supabase.from('tgd_customer_withdrawal_line_pallet_picks')
      .select('id, deposit_line_location_id, boxes, weight')
      .in('deposit_line_location_id', rows.slice(start, start + 150).map(row => row.id)));
    for (const pick of picks) {
      const total = picked.get(pick.deposit_line_location_id) ?? { boxes: 0, weight: 0 };
      total.boxes += Number(pick.boxes ?? 0);
      total.weight += Number(pick.weight ?? 0);
      picked.set(pick.deposit_line_location_id, total);
    }
  }
  return rows.map(row => {
    const total = picked.get(row.id) ?? { boxes: 0, weight: 0 };
    const boxes = row.boxes == null ? null : Number(row.boxes);
    const weight = row.weight == null ? null : Number(row.weight);
    const remainingBoxes = boxes == null ? null : Math.max(0, boxes - total.boxes);
    return {
      id: row.id, lineId: row.line_id, locationId: row.location_id,
      locationCode: row.tgd_locations?.location_code ?? '', palletNo: row.pallet_no,
      palletCode: buildPalletCode(row.tgd_locations?.location_code ?? '?', row.pallet_no),
      boxes, weight, remainingBoxes,
      remainingWeight: remainingBoxes === 0 ? 0 : weight == null ? null : Math.max(0, weight - total.weight),
      active: remainingBoxes == null || remainingBoxes > 0,
    };
  });
}

export async function listInventoryLocations(lineIds = []) {
  try {
    const rows = await readAllocations('line_id', lineIds);
    const data = new Map(lineIds.map(id => [id, []]));
    for (const row of rows) data.get(row.lineId)?.push(row);
    return { data, error: null };
  } catch (error) { return { data: null, error }; }
}

export function inventoryLocationLabel(allocations = []) {
  return [...new Set(allocations.filter(row => row.active).map(row => row.palletCode))].sort().join(', ');
}

export async function getInventoryLocationEditor(lineId) {
  try {
    if (!supabase) throw new Error('Supabase client is not configured');
    const [lineResult, allocations] = await Promise.all([
      supabase.from('tgd_customer_deposit_request_lines').select('id, actual_boxes, actual_weight').eq('id', lineId).single(),
      readAllocations('line_id', [lineId]),
    ]);
    if (lineResult.error) throw lineResult.error;
    const line = lineResult.data;
    return { data: {
      allocations,
      unallocatedBoxes: line.actual_boxes == null ? null : Math.max(0, Number(line.actual_boxes) - allocations.reduce((sum, row) => sum + (row.boxes ?? 0), 0)),
      unallocatedWeight: line.actual_weight == null ? null : Math.max(0, Number(line.actual_weight) - allocations.reduce((sum, row) => sum + (row.weight ?? 0), 0)),
    }, error: null };
  } catch (error) { return { data: null, error }; }
}

export async function getInventoryLocationSlots(locationId) {
  try {
    return { data: (await readAllocations('location_id', [locationId])).filter(row => row.active), error: null };
  } catch (error) { return { data: null, error }; }
}

export async function moveInventoryPallet(allocation, locationId, palletNo) {
  if (!supabase) return { data: null, error: new Error('Supabase client is not configured') };
  return supabase.rpc('tgd_move_inventory_pallet', {
    p_allocation_id: allocation.id, p_location_id: locationId, p_pallet_no: Number(palletNo),
    p_expected_location_id: allocation.locationId, p_expected_pallet_no: allocation.palletNo,
  });
}

export async function addInventoryPallet(lineId, locationId, palletNo, boxes, weight) {
  if (!supabase) return { data: null, error: new Error('Supabase client is not configured') };
  return supabase.rpc('tgd_add_inventory_pallet', {
    p_line_id: lineId, p_location_id: locationId, p_pallet_no: Number(palletNo), p_boxes: boxes, p_weight: weight,
  });
}
