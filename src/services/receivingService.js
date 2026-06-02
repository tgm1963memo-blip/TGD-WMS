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

  if (filters.status) {
    query = query.eq('status', filters.status);
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

  if (!input?.document_no) {
    return {
      data: null,
      error: new Error('document_no is required for receiving draft creation.'),
    };
  }

  return supabase.rpc('tgd_rpc_create_receiving_draft', {
    p_customer_id: input.customer_id,
    p_document_no: input.document_no,
  });
}

export async function updateReceivingDocument() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return {
    data: null,
    error: new Error('Direct update of receiving documents is locked. Use RPCs after controller approval.'),
  };
}

export async function postReceivingDocument(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  // Draft-only: posting is controlled by the real RPC `tgd_rpc_post_receiving_document`.
  // Do not perform posting from frontend while controller hold is active.
  // The implementation includes the RPC contract name for review but will not call it.
  // Controller-approved future call:
  // return supabase.rpc('tgd_rpc_post_receiving_document', { p_document_id: id });

  return {
    data: null,
    error: new Error('Posting receiving documents is disabled under controller HOLD'),
  };
}

export async function cancelReceivingDocument() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return {
    data: null,
    error: new Error('Cancellation is disabled until controller-approved RPC exists.'),
  };
}

export async function addReceivingLine({ documentId, productId, lotId, locationId, quantity, weight = null }) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  // Call the RPC contract that accepts location_id. This is a draft-only RPC invocation.
  return supabase.rpc('tgd_rpc_add_receiving_line', {
    p_document_id: documentId,
    p_product_id: productId,
    p_lot_id: lotId,
    p_location_id: locationId,
    p_quantity: quantity,
    p_weight: weight,
  });
}
