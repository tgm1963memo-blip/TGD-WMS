import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getCustomers(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_customers')
    .select('id, customer_code, customer_name, customer_type, tax_id, contact_name, phone, email, address, is_active, created_at')
    .order('customer_code', { ascending: true });

  if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);

  return query;
}

export async function upsertCustomer(customer) {
  if (!supabase) return missingSupabaseClientResult();

  const payload = {
    name: customer.customerName?.trim(),
    customer_code: customer.customerCode?.trim(),
    customer_name: customer.customerName?.trim(),
    customer_type: customer.customerType?.trim() || null,
    tax_id: customer.taxId?.trim() || null,
    contact_name: customer.contactName?.trim() || null,
    phone: customer.phone?.trim() || null,
    email: customer.email?.trim() || null,
    address: customer.address?.trim() || null,
    is_active: customer.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  if (customer.id) {
    return supabase.from('tgd_customers').update(payload).eq('id', customer.id).select().maybeSingle();
  }
  return supabase.from('tgd_customers').insert(payload).select().maybeSingle();
}

export async function getProducts(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_products').select('*').order('sku');
  return query;
}

export async function getWarehouses(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_warehouses').select('*').order('code');
  return query;
}

export async function getLocations(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_locations').select('*').order('code');

  if (filters.roomId) {
    query = query.eq('room_id', filters.roomId);
  }

  return query;
}
