import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getAdjustmentDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_adjustment_documents')
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

  if (filters.adjustmentType) {
    query = query.eq('adjustment_type', filters.adjustmentType);
  }

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }

  if (filters.sourceNo) {
    query = query.eq('source_no', filters.sourceNo);
  }

  return query;
}

export async function getAdjustmentDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_adjustment_documents')
    .select('*, tgd_adjustment_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createAdjustmentDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_adjustment_documents')
    .insert(input)
    .select()
    .single();
}

export async function updateAdjustmentDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_adjustment_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function postAdjustmentDocument(id, postedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_post_adjustment_document', {
    p_adjustment_document_id: id,
    p_posted_by: postedBy,
  });
}

export async function cancelAdjustmentDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_adjustment_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

