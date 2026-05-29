import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getPutawayDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_putaway_documents')
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

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }

  if (filters.sourceNo) {
    query = query.eq('source_no', filters.sourceNo);
  }

  return query;
}

export async function getPutawayDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_putaway_documents')
    .select('*, tgd_putaway_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createPutawayDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_putaway_documents')
    .insert(input)
    .select()
    .single();
}

export async function updatePutawayDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_putaway_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postPutawayDocument(id, postedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_putaway_document', {
    p_putaway_document_id: id,
    p_posted_by: postedBy,
  });
}

export async function cancelPutawayDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_putaway_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

