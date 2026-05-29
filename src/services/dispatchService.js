import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getDispatchDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_dispatch_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.withdrawalRequestId) {
    query = query.eq('withdrawal_request_id', filters.withdrawalRequestId);
  }

  if (filters.pickingDocumentId) {
    query = query.eq('picking_document_id', filters.pickingDocumentId);
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

  if (filters.dispatchType) {
    query = query.eq('dispatch_type', filters.dispatchType);
  }

  return query;
}

export async function getDispatchDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_dispatch_documents')
    .select('*, tgd_dispatch_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createDispatchDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_dispatch_documents')
    .insert(input)
    .select()
    .single();
}

export async function updateDispatchDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_dispatch_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postDispatchDocument(id, postedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_dispatch_document', {
    p_dispatch_document_id: id,
    p_posted_by: postedBy,
  });
}

export async function cancelDispatchDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_dispatch_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

