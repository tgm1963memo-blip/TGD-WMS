import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getReceivingDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_receiving_documents')
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

  if (filters.receivingType) {
    query = query.eq('receiving_type', filters.receivingType);
  }

  if (filters.sourceNo) {
    query = query.eq('source_no', filters.sourceNo);
  }

  return query;
}

export async function getReceivingDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_receiving_documents')
    .select('*, tgd_receiving_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createReceivingDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_receiving_documents')
    .insert(input)
    .select()
    .single();
}

export async function updateReceivingDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_receiving_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postReceivingDocument(id, postedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_receiving_document', {
    p_receiving_document_id: id,
    p_posted_by: postedBy,
  });
}

export async function cancelReceivingDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_receiving_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

