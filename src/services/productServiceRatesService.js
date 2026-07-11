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
  { value: 'PER_HOUR',   label: 'ต่อชั่วโมง (฿/ชม.)' },
  { value: 'FLAT',       label: 'อัตราคงที่ (Flat)' },
];

export const TEMPERATURE_TYPES = [
  { value: '',        label: '— ทุกอุณหภูมิ —' },
  { value: 'FROZEN',  label: 'แช่แข็ง (FROZEN)' },
  { value: 'CHILLED', label: 'แช่เย็น (CHILLED)' },
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

function shapeProductServiceRateRow(row = {}) {
  // A rate is either scoped to one product (tgd_customer_products embed
  // present) or to a whole customer's "all items" (customer_product_id is
  // null, tgd_customers embedded directly instead) — never both.
  const product = row.tgd_customer_products ?? null;
  const customer = product?.tgd_customers ?? row.tgd_customers ?? {};
  return {
    id: row.id,
    customer_product_id: row.customer_product_id,
    is_all_items: row.customer_product_id == null,
    service_type: row.service_type,
    rate: row.rate,
    unit_basis: row.unit_basis,
    period_days: row.period_days ?? null,
    temperature_type: row.temperature_type ?? null,
    max_quantity: row.max_quantity ?? null,
    currency: row.currency,
    note: row.note,
    is_active: row.is_active,
    created_at: row.created_at,
    customer_id: customer.id ?? row.customer_id ?? product?.customer_id ?? null,
    customer_code: customer.customer_code ?? null,
    customer_name: customer.customer_name ?? null,
    customer_product_code: product?.customer_product_code ?? null,
    product_name: product?.product_name ?? null,
  };
}

// Full cross-customer/cross-product listing (with filters) that powers the
// Storage Rate page's table view — the earlier listProductServiceRates
// functions only ever scope to one product or one customer, so there was no
// way to see/filter every rate in the system at once.
//
// customerId filtering happens in JS after the fetch (not as a query
// filter) because a rate's customer can come from either the embedded
// product relation or the rate's own customer_id column (for all-items
// rates) — PostgREST can't OR a filter across two different relations in
// one request.
export async function listAllProductServiceRates(filters = {}) {
  if (!supabase) return missing();

  let query = supabase
    .from('tgd_customer_product_service_rates')
    .select(`
      id, customer_product_id, customer_id, service_type, rate, unit_basis,
      period_days, temperature_type, max_quantity, currency, note, is_active, created_at,
      tgd_customer_products(
        id, customer_product_code, product_name, customer_id,
        tgd_customers(id, customer_code, customer_name)
      ),
      tgd_customers(id, customer_code, customer_name)
    `)
    .order('service_type');

  if (filters.customerProductId) query = query.eq('customer_product_id', filters.customerProductId);
  if (filters.serviceType) query = query.eq('service_type', filters.serviceType);
  if (filters.isActive != null) query = query.eq('is_active', filters.isActive);

  const result = await query;
  if (result.error) return { data: null, error: result.error };

  let rows = result.data ?? [];
  if (filters.customerId) {
    rows = rows.filter((row) =>
      (row.tgd_customer_products?.customer_id ?? row.customer_id) === filters.customerId);
  }

  return { data: rows.map(shapeProductServiceRateRow), error: null };
}

// Customer + product lookup used to resolve "customer_code" +
// "customer_product_code" (the human-readable pair used in the bulk
// import/export spreadsheet) back to a customer_product_id.
export async function listCustomerProductsForRateImport() {
  if (!supabase) return missing();
  return supabase
    .from('tgd_customer_products')
    .select('id, customer_id, customer_product_code, product_name, tgd_customers!inner(customer_code, customer_name)')
    .order('customer_product_code');
}

// Applies a batch of parsed rate rows one at a time through the same
// tgd_upsert_product_service_rate RPC the single-row form uses (upsert by
// (customer_product_id, service_type), so re-importing the same file is
// safe/idempotent), collecting per-row failures instead of aborting the
// whole batch on the first error.
export async function bulkUpsertProductServiceRates(rows = []) {
  const results = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertProductServiceRate(row);
    results.push({ row, error: result.error });
  }

  const failed = results.filter((r) => r.error);
  return {
    data: {
      total: rows.length,
      succeeded: rows.length - failed.length,
      failed: failed.length,
      errors: failed.map((r) => ({ row: r.row, message: r.error.message ?? String(r.error) })),
    },
    error: null,
  };
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
    p_customer_id:         payload.customerId ?? null,
    p_period_days:         payload.periodDays != null && payload.periodDays !== '' ? Number(payload.periodDays) : null,
    p_temperature_type:    payload.temperatureType || null,
    p_max_quantity:        payload.maxQuantity != null && payload.maxQuantity !== '' ? Number(payload.maxQuantity) : null,
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
  if (payload.id) {
    const updateRow = {
      display_name: payload.displayName,
      description:  payload.description ?? null,
      base_role:    payload.baseRole ?? null,
    };
    return supabase.from('tgd_role_definitions').update(updateRow).eq('id', payload.id).select().single();
  }
  const insertRow = {
    role_code:    payload.roleCode,
    display_name: payload.displayName,
    description:  payload.description ?? null,
    is_system:    false,
    base_role:    payload.baseRole ?? null,
    sort_order:   payload.sortOrder ?? 99,
    is_active:    payload.isActive ?? true,
  };
  return supabase.from('tgd_role_definitions').insert(insertRow).select().single();
}
