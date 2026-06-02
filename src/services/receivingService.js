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

function firstPresent(row, keys) {
  return keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function isActiveRow(row) {
  return row?.is_active !== false;
}

function sortByLabel(left, right) {
  return String(left.label).localeCompare(String(right.label));
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
    .select('id, name');

  return {
    data: (data ?? [])
      .filter(isActiveRow)
      .map((customer) => {
        const name = customer.name ?? null;

        return {
          id: customer.id,
          code: null,
          name,
          label: buildLabel(null, name, customer.id),
        };
      })
      .sort(sortByLabel),
    error,
  };
}

export async function getReceivingProducts() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_products')
    .select('id, sku, name');

  return {
    data: (data ?? [])
      .filter(isActiveRow)
      .map((product) => {
        const code = product.sku ?? null;
        const name = product.name ?? null;

        return {
          id: product.id,
          code,
          name,
          label: buildLabel(code, name, product.id),
        };
      })
      .sort(sortByLabel),
    error,
  };
}

export async function getReceivingLots() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_lots')
    .select('id, lot_number, product_id, customer_id');

  return {
    data: (data ?? [])
      .filter(isActiveRow)
      .map((lot) => {
        const code = lot.lot_number ?? null;

        return {
          id: lot.id,
          lot_no: code,
          code,
          name: code,
          product_id: lot.product_id ?? null,
          customer_id: lot.customer_id ?? null,
          label: code || lot.id,
        };
      })
      .sort(sortByLabel),
    error,
  };
}

export async function getReceivingLocations() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const { data, error } = await supabase
    .from('tgd_locations')
    .select('id, code, name');

  return {
    data: (data ?? [])
      .filter(isActiveRow)
      .map((location) => {
        const code = location.code ?? null;
        const name = location.name ?? null;

        return {
          id: location.id,
          code,
          name,
          room_id: location.room_id ?? null,
          warehouse_id: location.warehouse_id ?? null,
          label: buildLabel(code, name, location.id),
        };
      })
      .sort(sortByLabel),
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
