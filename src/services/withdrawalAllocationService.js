import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getWithdrawalAllocations(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_withdrawal_allocations')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.withdrawalRequestId) {
    query = query.eq('withdrawal_request_id', filters.withdrawalRequestId);
  }

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.allocationMethod) {
    query = query.eq('allocation_method', filters.allocationMethod);
  }

  return query;
}

export async function getWithdrawalAllocationById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_allocations')
    .select('*, tgd_withdrawal_allocation_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createWithdrawalAllocation(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_allocations')
    .insert(input)
    .select()
    .single();
}

export async function updateWithdrawalAllocation(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_allocations')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postWithdrawalAllocation(id, allocatedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_withdrawal_allocation', {
    p_allocation_id: id,
    p_allocated_by: allocatedBy,
  });
}

export async function cancelWithdrawalAllocation(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_withdrawal_allocations')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

