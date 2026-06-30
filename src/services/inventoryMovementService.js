import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function postInventoryMovement(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_inventory_movement', { input });
}

export async function getInventoryMovements(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_inventory_movements')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.productId) {
    query = query.eq('product_id', filters.productId);
  }

  if (filters.movementType) {
    query = query.eq('movement_type', filters.movementType);
  }

  if (filters.referenceType) {
    query = query.eq('reference_type', filters.referenceType);
  }

  if (filters.referenceNo) {
    query = query.eq('reference_no', filters.referenceNo);
  }

  return query;
}

export async function getStockBalances(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_stock_balances')
    .select('*')
    .order('updated_at', { ascending: false });

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.productId) {
    query = query.eq('product_id', filters.productId);
  }

  if (filters.lotId) {
    query = query.eq('lot_id', filters.lotId);
  }

  if (filters.locationId) {
    query = query.eq('location_id', filters.locationId);
  }

  if (filters.palletId) {
    query = query.eq('pallet_id', filters.palletId);
  }

  return query;
}

export async function checkLocationHasInventory(locationId) {
  if (!locationId) return false;

  // Check confirmed stock balance first
  const { data: balances } = await getStockBalances({ locationId });
  if (balances && balances.some(s => s.quantity_boxes > 0 || s.quantity_weight > 0)) {
    return true;
  }

  // Check deposit lines at this location (any active status — unconfirmed or already confirmed)
  if (!supabase) return false;
  const { data: lines, error } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, tgd_customer_deposit_requests!inner(status)')
    .eq('location_id', locationId)
    .in('tgd_customer_deposit_requests.status', [
      'DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED',
      'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW',
      'ADMIN_RECOUNT_REQUESTED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED',
    ])
    .limit(1);

  if (!error && lines && lines.length > 0) {
    return true;
  }

  return false;
}


