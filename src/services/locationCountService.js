import { supabase } from './supabaseClient.js';
import { missingSupabaseClientResult } from './customerPortalServiceUtils.js';

// Stock count walked location by location from the Scan Center. Expected
// stock = pallet allocations minus effective picks, computed server-side
// (see supabase/migrations/20261007110000_location_stock_count.sql). A count
// never changes stock -- differences are a report for admin review.

export const LOCATION_COUNT_RESULT_LABELS = Object.freeze({
  MATCH: 'ตรง',
  SHORT: 'ขาด',
  OVER: 'เกิน',
  MISSING: 'ไม่พบ',
  UNEXPECTED: 'ไม่อยู่ในระบบ',
});

export const LOCATION_COUNT_STATUS_LABELS = Object.freeze({
  OPEN: 'กำลังนับ',
  SUBMITTED: 'รอตรวจ',
  REVIEWED: 'ตรวจแล้ว',
  CANCELLED: 'ยกเลิก',
});

export const canReviewLocationCount = (role) => ['admin', 'warehouse_admin', 'warehouse_manager'].includes(role);

export function isLocationCountVariance(line) {
  return line?.result && line.result !== 'MATCH';
}

export async function startLocationCount(actorProfileId = null) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_start_location_count', { p_actor_profile_id: actorProfileId });
  return { data: data ?? null, error };
}

export async function getLocationCountExpected(locationId) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_get_location_count_expected', { p_location_id: locationId });
  return { data: Array.isArray(data) ? data : [], error };
}

// results: [{ allocation_id?, counted_boxes, counted_weight, note?,
// tracking_code?, product_name?, customer_product_code?, lot_no? }]
export async function recordLocationCountRow(sessionId, locationId, results, actorProfileId = null) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_record_location_count_row', {
    p_session_id: sessionId,
    p_location_id: locationId,
    p_results: results ?? [],
    p_actor_profile_id: actorProfileId,
  });
  return { data: data ?? null, error };
}

export async function setLocationCountStatus(sessionId, status, { actorProfileId = null, note = null } = {}) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_set_location_count_status', {
    p_session_id: sessionId,
    p_status: status,
    p_actor_profile_id: actorProfileId,
    p_note: note,
  });
  return { data: data ?? null, error };
}

export async function listLocationCountSessions({ limit = 100 } = {}) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase
    .from('tgd_location_count_sessions')
    .select('*, tgd_location_count_lines(location_id, result)')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error };
  const sessions = (data ?? []).map(({ tgd_location_count_lines: lines = [], ...session }) => ({
    ...session,
    locationCount: new Set(lines.map((l) => l.location_id)).size,
    lineCount: lines.length,
    varianceCount: lines.filter(isLocationCountVariance).length,
  }));
  return { data: sessions, error: null };
}

export async function getOpenLocationCountSession() {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase
    .from('tgd_location_count_sessions')
    .select('*')
    .eq('status', 'OPEN')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data ?? null, error };
}

export async function listLocationCountLines(sessionId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!sessionId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('tgd_location_count_lines')
    .select('*')
    .eq('session_id', sessionId)
    .order('location_code', { ascending: true })
    .order('pallet_no', { ascending: true, nullsFirst: false });
  return { data: data ?? [], error };
}
