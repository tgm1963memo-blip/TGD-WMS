import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableText,
} from './customerPortalServiceUtils.js';

const UNIT_SELECT = [
  'id',
  'customer_product_id',
  'unit_code',
  'unit_label',
  'weight_per_unit_kg',
  'boxes_per_unit',
  'display_order',
  'is_active',
  'note',
].join(', ');

export async function listCustomerProductUnits(customerProductId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_product_units')
    .select(UNIT_SELECT)
    .eq('customer_product_id', customerProductId)
    .order('display_order', { ascending: true });
}

export async function upsertCustomerProductUnit(payload = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_upsert_customer_product_unit', {
    p_unit_id: payload.unitId ?? null,
    p_customer_product_id: payload.customerProductId,
    p_unit_code: toNullableText(payload.unitCode),
    p_unit_label: toNullableText(payload.unitLabel),
    p_weight_per_unit_kg: payload.weightPerUnitKg ?? null,
    p_boxes_per_unit: payload.boxesPerUnit ?? null,
    p_display_order: payload.displayOrder ?? 0,
    p_is_active: typeof payload.isActive === 'boolean' ? payload.isActive : true,
    p_note: toNullableText(payload.note),
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}

export async function deleteCustomerProductUnit(unitId) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_delete_customer_product_unit', { p_unit_id: unitId });
  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}
