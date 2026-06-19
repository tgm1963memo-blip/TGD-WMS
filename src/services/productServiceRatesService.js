import { supabase } from './supabaseClient.js';

function missing() {
  return { data: null, error: new Error('Supabase client not configured.') };
}

export const SERVICE_TYPES = [
  { value: 'STORAGE',      label: 'ค่าฝากสินค้า',      labelEn: 'Storage' },
  { value: 'HANDLING_IN',  label: 'ค่านำเข้า',          labelEn: 'Handling In' },
  { value: 'HANDLING_OUT', label: 'ค่านำออก',           labelEn: 'Handling Out' },
  { value: 'LABEL',        label: 'ค่าติดฉลาก',         labelEn: 'Labeling' },
  { value: 'FREEZING',     label: 'ค่าแช่แข็ง',         labelEn: 'Freezing' },
  { value: 'OTHER',        label: 'ค่าบริการอื่นๆ',     labelEn: 'Other' },
];

export const UNIT_BASIS = [
  { value: 'PER_KG',     label: 'ต่อกิโลกรัม (฿/กก.)' },
  { value: 'PER_UNIT',   label: 'ต่อหน่วย (฿/หน่วย)' },
  { value: 'PER_PALLET', label: 'ต่อพาเลท (฿/พาเลท)' },
  { value: 'PER_TRIP',   label: 'ต่อเที่ยว (฿/เที่ยว)' },
  { value: 'PER_DAY',    label: 'ต่อวัน (฿/วัน)' },
  { value: 'FLAT',       label: 'อัตราคงที่ (Flat)' },
];

export async function listProductServiceRates(customerProductId) {
  if (!supabase) return missing();
  return supabase
    .from('tgd_customer_product_service_rates')
    .select('id, customer_product_id, service_type, rate, unit_basis, currency, note, is_active, created_at')
    .eq('customer_product_id', customerProductId)
    .order('service_type');
}

export async function listProductServiceRatesByCustomer(customerId) {
  if (!supabase) return missing();
  return supabase
    .from('tgd_customer_product_service_rates')
    .select('id, customer_product_id, service_type, rate, unit_basis, currency, note, is_active, tgd_customer_products!inner(id, customer_product_code, product_name, customer_id)')
    .eq('tgd_customer_products.customer_id', customerId)
    .order('service_type');
}

export async function upsertProductServiceRate(payload = {}) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_upsert_product_service_rate', {
    p_rate_id:             payload.rateId ?? null,
    p_customer_product_id: payload.customerProductId ?? null,
    p_service_type:        payload.serviceType,
    p_rate:                payload.rate != null ? Number(payload.rate) : 0,
    p_unit_basis:          payload.unitBasis,
    p_currency:            payload.currency ?? 'THB',
    p_note:                payload.note ?? null,
    p_is_active:           payload.isActive ?? true,
  });
  return { data, error };
}

export async function listRoleDefinitions() {
  if (!supabase) return missing();
  return supabase
    .from('tgd_role_definitions')
    .select('id, role_code, display_name, description, is_system, base_role, sort_order, is_active')
    .order('sort_order');
}

export async function upsertRoleDefinition(payload = {}) {
  if (!supabase) return missing();
  const row = {
    role_code:    payload.roleCode,
    display_name: payload.displayName,
    description:  payload.description ?? null,
    is_system:    false,
    base_role:    payload.baseRole ?? null,
    sort_order:   payload.sortOrder ?? 99,
    is_active:    payload.isActive ?? true,
  };
  if (payload.id) {
    return supabase.from('tgd_role_definitions').update(row).eq('id', payload.id).select().single();
  }
  return supabase.from('tgd_role_definitions').insert(row).select().single();
}
