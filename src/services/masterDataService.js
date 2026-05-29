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

  let query = supabase.from('tgd_customers').select('*').order('customer_code');

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  return query;
}

export async function getProducts(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_products').select('*').order('product_code');

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  return query;
}

export async function getWarehouses(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_warehouses').select('*').order('warehouse_code');

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  return query;
}

export async function getLocations(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase.from('tgd_locations').select('*').order('location_code');

  if (filters.roomId) {
    query = query.eq('room_id', filters.roomId);
  }

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  return query;
}
