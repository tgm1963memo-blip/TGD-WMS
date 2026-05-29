import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getHandheldPutawaySessions(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_handheld_putaway_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.putawayDocumentId) {
    query = query.eq('putaway_document_id', filters.putawayDocumentId);
  }

  if (filters.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.deviceId) {
    query = query.eq('device_id', filters.deviceId);
  }

  if (filters.operatorId) {
    query = query.eq('operator_id', filters.operatorId);
  }

  return query;
}

export async function getHandheldPutawaySessionById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_putaway_sessions')
    .select('*, tgd_handheld_putaway_scans(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createHandheldPutawaySession(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_putaway_sessions')
    .insert(input)
    .select()
    .single();
}

export async function recordHandheldPutawayScan(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_record_handheld_putaway_scan', {
    input,
  });
}

export async function completeHandheldPutawaySession(id, completedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_complete_handheld_putaway_session', {
    p_session_id: id,
    p_completed_by: completedBy,
  });
}

export async function cancelHandheldPutawaySession(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_putaway_sessions')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}
