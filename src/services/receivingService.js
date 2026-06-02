import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function buildLabel(code, name, id) {
  const parts = [code, name].filter(Boolean);
  return parts.length ? parts.join(' - ') : id;
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

export async function getReceivingStockMovements(documentId) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_stock_movements')
    .select(`
      id,
      movement_type,
      quantity,
      weight,
      from_location_id,
      to_location_id,
      source_document_id,
      source_line_id,
      created_at,
      updated_at
    `)
    .eq('source_module', 'RECEIVING')
    .eq('source_document_id', documentId)
    .order('created_at', { ascending: true });
}

export async function getReceivingCustomers() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_customers')
    .select('id, customer_code, customer_name')
    .eq('is_active', true)
    .order('customer_code', { ascending: true });

  return {
    data: (data ?? []).map((customer) => ({
      id: customer.id,
      code: customer.customer_code,
      name: customer.customer_name,
      label: buildLabel(customer.customer_code, customer.customer_name, customer.id),
    })),
    error,
  };
}

export async function getReceivingProducts() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_products')
    .select('id, product_code, product_name')
    .eq('is_active', true)
    .order('product_code', { ascending: true });

  return {
    data: (data ?? []).map((product) => ({
      id: product.id,
      code: product.product_code,
      name: product.product_name,
      label: buildLabel(product.product_code, product.product_name, product.id),
    })),
    error,
  };
}

export async function getReceivingLots() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_lots')
    .select('id, lot_no, product_id')
    .eq('is_active', true)
    .order('lot_no', { ascending: true });

  return {
    data: (data ?? []).map((lot) => ({
      id: lot.id,
      lot_no: lot.lot_no,
      code: lot.lot_no,
      product_id: lot.product_id,
      label: buildLabel(lot.lot_no, null, lot.id),
    })),
    error,
  };
}

export async function getReceivingLocations() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_locations')
    .select('id, location_code, location_name, room_id')
    .eq('is_active', true)
    .order('location_code', { ascending: true });

  return {
    data: (data ?? []).map((location) => ({
      id: location.id,
      code: location.location_code,
      name: location.location_name,
      room_id: location.room_id,
      warehouse_id: location.warehouse_id,
      label: buildLabel(location.location_code, location.location_name, location.id),
    })),
    error,
  };
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

  return supabase.rpc('tgd_rpc_post_receiving_document', {
    p_document_id: id,
  });
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

export async function addReceivingLine(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_rpc_add_receiving_line', {
    p_document_id: input.document_id ?? input.documentId,
    p_product_id: input.product_id ?? input.productId,
    p_lot_id: input.lot_id ?? input.lotId,
    p_location_id: input.location_id ?? input.locationId,
    p_quantity: input.quantity,
    p_weight: input.weight ?? null,
  });
}
