import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function resolveBarcode(scanValue) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_resolve_barcode', {
    p_scan_value: scanValue,
  });
}

export async function logBarcodeScan(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_log_barcode_scan', {
    input,
  });
}

export async function getBarcodeScanEvents(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_barcode_scan_events')
    .select('*')
    .order('scanned_at', { ascending: false });

  if (filters.scanValue) {
    query = query.eq('scan_value', filters.scanValue);
  }

  if (filters.resolvedEntityType) {
    query = query.eq('resolved_entity_type', filters.resolvedEntityType);
  }

  if (filters.resolvedEntityId) {
    query = query.eq('resolved_entity_id', filters.resolvedEntityId);
  }

  if (filters.scanContext) {
    query = query.eq('scan_context', filters.scanContext);
  }

  if (filters.scanResult) {
    query = query.eq('scan_result', filters.scanResult);
  }

  if (filters.scanSource) {
    query = query.eq('scan_source', filters.scanSource);
  }

  if (filters.userProfileId) {
    query = query.eq('user_profile_id', filters.userProfileId);
  }

  if (filters.authUserId) {
    query = query.eq('auth_user_id', filters.authUserId);
  }

  if (filters.relatedDocumentType) {
    query = query.eq('related_document_type', filters.relatedDocumentType);
  }

  if (filters.relatedDocumentId) {
    query = query.eq('related_document_id', filters.relatedDocumentId);
  }

  return query;
}

export async function getBarcodeAliases(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_barcode_aliases')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.barcodeValue) {
    query = query.eq('barcode_value', filters.barcodeValue);
  }

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId);
  }

  if (filters.barcodeType) {
    query = query.eq('barcode_type', filters.barcodeType);
  }

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  return query;
}

export async function createBarcodeAlias(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_barcode_aliases')
    .insert(input)
    .select()
    .single();
}

export async function deactivateBarcodeAlias(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_barcode_aliases')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();
}
