import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getPickingDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_picking_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.withdrawalRequestId) {
    query = query.eq('withdrawal_request_id', filters.withdrawalRequestId);
  }

  if (filters.allocationId) {
    query = query.eq('allocation_id', filters.allocationId);
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

  if (filters.pickingMethod) {
    query = query.eq('picking_method', filters.pickingMethod);
  }

  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  return query;
}

export async function getPickingDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_picking_documents')
    .select('*, tgd_picking_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createPickingDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_picking_documents')
    .insert(input)
    .select()
    .single();
}

export async function updatePickingDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_picking_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function confirmPickingDocument(id, completedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_confirm_picking_document', {
    p_picking_document_id: id,
    p_completed_by: completedBy,
  });
}

export async function cancelPickingDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_picking_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

