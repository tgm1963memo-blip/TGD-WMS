import { supabase } from './supabaseClient.js';
import { getReceivingConfirmedUnifiedMovements } from './unifiedMovementReadService.js';

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

export function normalizeReceivingDocumentId(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      return first.id || first.document_id || first.receiving_document_id || first.receiving_id || '';
    }
    return '';
  }

  if (typeof data === 'object') {
    return data.id || data.document_id || data.receiving_document_id || data.receiving_id || '';
  }

  return '';
}

function getReceivingRpcResponseType(data) {
  if (data === null) return 'null';
  if (typeof data === 'undefined') return 'undefined';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

function getReceivingRpcResponsePreview(data) {
  if (data === null || typeof data === 'undefined') return 'None';

  try {
    const serialized = JSON.stringify(data);
    return String(serialized ?? data).substring(0, 50);
  } catch {
    return String(data).substring(0, 50);
  }
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

export async function getReceivingConfirmedMovements(documentId) {
  return getReceivingConfirmedUnifiedMovements(documentId);
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

export async function getReceivingWarehouses() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  console.info("Receiving warehouses loader called");
  const { data, error } = await supabase
    .from('tgd_warehouses')
    .select('id, code, name');

  const rawCount = data ? data.length : 0;
  console.info(`Receiving warehouses returned count: ${rawCount}`);

  const finalData = (data ?? [])
      .map((warehouse) => {
        const code = warehouse.code ?? null;
        const name = warehouse.name ?? null;

        return {
          id: warehouse.id,
          code,
          name,
          label: buildLabel(code, name, warehouse.id),
        };
      })
      .sort(sortByLabel);

  console.info(`Receiving warehouses after filter count: ${finalData.length}`);

  return {
    data: finalData,
    error,
    rawCount,
    filteredCount: finalData.length,
    called: true,
  };
}

export async function getReceivingProducts() {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  console.info("Receiving products loader called");
  const { data, error } = await supabase
    .from('tgd_products')
    .select('id, sku, name, unit');

  const rawCount = data ? data.length : 0;
  console.info(`Receiving products returned count: ${rawCount}`);

  const finalData = (data ?? [])
      .map((product) => {
        const code = product.sku ?? null;
        const name = product.name ?? null;

        return {
          id: product.id,
          code,
          name,
          unit: product.unit ?? null,
          label: buildLabel(code, name, product.id),
        };
      })
      .sort(sortByLabel);

  console.info(`Receiving products after filter count: ${finalData.length}`);

  return {
    data: finalData,
    error,
    rawCount,
    filteredCount: finalData.length,
    called: true,
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
    .select('id, code, name, description');

  return {
    data: (data ?? [])
      .map((location) => {
        const code = location.code ?? null;
        const name = location.name || location.description || null;

        return {
          id: location.id,
          code,
          name,
          label: buildLabel(code, name, location.id),
        };
      })
      .sort(sortByLabel),
    error,
  };
}

export async function createReceivingDocument(input) {
  const rpcName = 'tgd_rpc_create_receiving_draft';
  const baseDiagnostics = {
    rpcCalled: false,
    rpcName,
    errorMessage: null,
    rawResponseType: null,
    rawResponsePreview: null,
    normalizedDocumentId: null,
  };

  if (!supabase) {
    const result = missingSupabaseClientResult();
    return {
      ...result,
      diagnostics: {
        ...baseDiagnostics,
        errorMessage: result.error.message,
      },
    };
  }

  if (!input?.document_no) {
    return {
      data: null,
      error: new Error('document_no is required for receiving draft creation.'),
      diagnostics: {
        ...baseDiagnostics,
        errorMessage: 'document_no is required',
      },
    };
  }

  let rpcCalled = false;
  let response;

  try {
    rpcCalled = true;
    response = await supabase.rpc('tgd_rpc_create_receiving_draft', {
      p_customer_id: input.customer_id,
      p_document_no: input.document_no,
    });
  } catch (error) {
    return {
      data: null,
      error,
      diagnostics: {
        ...baseDiagnostics,
        rpcCalled,
        errorMessage: error?.message || String(error),
      },
    };
  }

  const rawResponseType = getReceivingRpcResponseType(response.data);
  const rawResponsePreview = getReceivingRpcResponsePreview(response.data);

  if (response.error) {
    return {
      ...response,
      diagnostics: {
        ...baseDiagnostics,
        rpcCalled,
        rawResponseType,
        rawResponsePreview,
        errorMessage: response.error.message || String(response.error),
      },
    };
  }

  const documentId = normalizeReceivingDocumentId(response.data);
  if (!documentId) {
    return {
      data: null,
      error: new Error(`DRAFT_ID_MISSING: Could not parse document id from RPC response: ${JSON.stringify(response.data)}`),
      diagnostics: {
        ...baseDiagnostics,
        rpcCalled,
        rawResponseType,
        rawResponsePreview,
        errorMessage: 'DRAFT_ID_MISSING',
      },
    };
  }

  return {
    data: {
      id: documentId,
      document_id: documentId,
    },
    error: null,
    diagnostics: {
      ...baseDiagnostics,
      rpcCalled,
      rawResponseType,
      rawResponsePreview,
      normalizedDocumentId: documentId,
    },
  };
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

export async function resolveLotForReceiving(productId, lotNo) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  if (!productId || !lotNo) {
    return {
      data: null,
      error: new Error('product_id and lot_no are required for lot resolution.'),
    };
  }

  return supabase.rpc('tgd_rpc_resolve_or_create_lot', {
    p_product_id: productId,
    p_lot_no: lotNo,
  });
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
