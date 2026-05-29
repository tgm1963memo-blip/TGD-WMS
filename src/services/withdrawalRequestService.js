import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getWithdrawalRequests(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.withdrawalType) {
    query = query.eq('withdrawal_type', filters.withdrawalType);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.routeCode) {
    query = query.eq('route_code', filters.routeCode);
  }

  return query;
}

export async function getWithdrawalRequestById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_requests')
    .select('*, tgd_withdrawal_request_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createWithdrawalRequest(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_requests')
    .insert(input)
    .select()
    .single();
}

export async function updateWithdrawalRequest(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_requests')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function confirmWithdrawalRequest(id, confirmedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_confirm_withdrawal_request', {
    p_withdrawal_request_id: id,
    p_confirmed_by: confirmedBy,
  });
}

export async function cancelWithdrawalRequest(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_requests')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

