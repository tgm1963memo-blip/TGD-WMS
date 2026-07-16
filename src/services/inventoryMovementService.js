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
  if (balances && balances.some(s => s.qty_on_hand > 0)) {
    return true;
  }

  // Check deposit lines that have actual received goods at this location.
  // A line with actual_boxes or actual_weight recorded means warehouse
  // physically placed goods here — checking actual_boxes alone missed
  // weight-only receipts (actual_boxes left null/0, only weight tracked),
  // letting a second product get silently assigned to an already-occupied
  // location.
  // No join needed — avoids PostgREST filter-on-related-table issues.
  if (!supabase) return false;
  const { data: lines } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id')
    .eq('location_id', locationId)
    .or('actual_boxes.gt.0,actual_weight.gt.0')
    .limit(1);

  if (lines && lines.length > 0) {
    return true;
  }

  return false;
}


