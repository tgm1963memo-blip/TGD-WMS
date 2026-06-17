import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableText,
} from './customerPortalServiceUtils.js';

const CATALOG_SELECT = [
  'id',
  'customer_id',
  'customer_product_code',
  'product_name',
  'internal_product_code',
  'internal_product_id',
  'uom',
  'temperature_type',
  'argent_type',
  'storage_charge_basis',
  'is_active',
  'note',
  'created_at',
  'updated_at',
].join(', ');

export async function listCustomerProducts(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customer_products')
    .select(CATALOG_SELECT)
    .order('customer_product_code', { ascending: true });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.activeOnly) query = query.eq('is_active', true);
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`customer_product_code.ilike.${term},product_name.ilike.${term}`);
  }

  return query;
}

export async function upsertCustomerProduct(payload = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_upsert_customer_product', {
    p_product_id: payload.productId ?? null,
    p_customer_id: payload.customerId ?? null,
    p_customer_product_code: toNullableText(payload.customerProductCode),
    p_product_name: toNullableText(payload.productName),
    p_internal_product_code: toNullableText(payload.internalProductCode),
    p_internal_product_id: payload.internalProductId ?? null,
    p_uom: toNullableText(payload.uom),
    p_temperature_type: toNullableText(payload.temperatureType),
    p_argent_type: toNullableText(payload.argentType),
    p_storage_charge_basis: toNullableText(payload.storageChargeBasis),
    p_note: toNullableText(payload.note),
    p_is_active: typeof payload.isActive === 'boolean' ? payload.isActive : true,
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}

export async function deactivateCustomerProduct(productId) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_deactivate_customer_product', {
    p_product_id: productId,
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}
