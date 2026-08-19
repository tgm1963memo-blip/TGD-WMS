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
    .select('id, customer_code, customer_name, customer_type, tax_id, contact_name, phone, email, address, is_active, created_at, notify_deposit_confirmed, notify_withdrawal_completed, notify_invoice_approved')
    .order('customer_code', { ascending: true });

  if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);

  return query;
}



export async function upsertCustomer(form = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const nameValue = form.customerName?.trim() ?? '';
  const payload = {
    name: nameValue,
    customer_code: form.customerCode?.trim() ?? '',
    customer_name: nameValue,
    customer_type: form.customerType || null,
    tax_id: form.taxId?.trim() || null,
    contact_name: form.contactName?.trim() || null,
    phone: form.phone?.trim() || null,
    email: form.email?.trim() || null,
    address: form.address?.trim() || null,
    is_active: form.isActive ?? true,
    notify_deposit_confirmed: form.notifyDepositConfirmed ?? true,
    notify_withdrawal_completed: form.notifyWithdrawalCompleted ?? true,
    notify_invoice_approved: form.notifyInvoiceApproved ?? true,
  };

  if (form.id) {
    const { data, error } = await supabase
      .from('tgd_customers')
      .update(payload)
      .eq('id', form.id)
      .select()
      .maybeSingle();
    return { data, error };
  }

  const { data, error } = await supabase
    .from('tgd_customers')
    .insert(payload)
    .select()
    .maybeSingle();
  return { data, error };
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

  let query = supabase.from('tgd_locations').select('*').order('location_code', { nullsFirst: false });

  if (filters.roomId) {
    query = query.eq('room_id', filters.roomId);
  }
  if (filters.zoneId) {
    query = query.eq('zone_id', filters.zoneId);
  }

  return query;
}
