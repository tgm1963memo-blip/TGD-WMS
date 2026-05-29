import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getStockCountDocuments(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_stock_count_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.countType) {
    query = query.eq('count_type', filters.countType);
  }

  if (filters.countDate) {
    query = query.eq('count_date', filters.countDate);
  }

  return query;
}

export async function getStockCountDocumentById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_stock_count_documents')
    .select('*, tgd_stock_count_lines(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createStockCountDocument(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_stock_count_documents')
    .insert(input)
    .select()
    .single();
}

export async function updateStockCountDocument(id, input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_stock_count_documents')
    .update(input)
    .eq('id', id)
    .select()
    .single();
}

export async function completeStockCountDocument(id, completedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_complete_stock_count_document', {
    p_stock_count_document_id: id,
    p_completed_by: completedBy,
  });
}

export async function createAdjustmentFromStockCount(id, createdBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_create_adjustment_from_stock_count', {
    p_stock_count_document_id: id,
    p_created_by: createdBy,
  });
}

export async function cancelStockCountDocument(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_stock_count_documents')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}
