import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getHandheldReceivingSessions(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_handheld_receiving_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.receivingDocumentId) {
    query = query.eq('receiving_document_id', filters.receivingDocumentId);
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

export async function getHandheldReceivingSessionById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_receiving_sessions')
    .select('*, tgd_handheld_receiving_scans(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createHandheldReceivingSession(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_receiving_sessions')
    .insert(input)
    .select()
    .single();
}

export async function recordHandheldReceivingScan(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_record_handheld_receiving_scan', {
    input,
  });
}

export async function completeHandheldReceivingSession(id, completedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_complete_handheld_receiving_session', {
    p_session_id: id,
    p_completed_by: completedBy,
  });
}

export async function cancelHandheldReceivingSession(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_receiving_sessions')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}
