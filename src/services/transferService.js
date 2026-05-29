import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getTransferDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_transfer_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.fromWarehouseId) {
    query = query.eq('from_warehouse_id', filters.fromWarehouseId);
  }

  if (filters.toWarehouseId) {
    query = query.eq('to_warehouse_id', filters.toWarehouseId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.transferType) {
    query = query.eq('transfer_type', filters.transferType);
  }

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }

  if (filters.sourceNo) {
    query = query.eq('source_no', filters.sourceNo);
  }

  return query;
}

export async function getTransferDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_transfer_documents')
    .select('*, tgd_transfer_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createTransferDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_transfer_documents')
    .insert(input)
    .select()
    .single();
}

export async function updateTransferDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_transfer_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postTransferDocument(id, postedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_transfer_document', {
    p_transfer_document_id: id,
    p_posted_by: postedBy,
  });
}

export async function cancelTransferDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_transfer_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

