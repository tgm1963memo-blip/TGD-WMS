import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getHandheldPickingSessions(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_handheld_picking_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.pickingDocumentId) {
    query = query.eq('picking_document_id', filters.pickingDocumentId);
  }

  if (filters.withdrawalRequestId) {
    query = query.eq('withdrawal_request_id', filters.withdrawalRequestId);
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

export async function getHandheldPickingSessionById(id) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_picking_sessions')
    .select('*, tgd_handheld_picking_scans(*)')
    .eq('id', id)
    .maybeSingle();
}

export async function createHandheldPickingSession(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_picking_sessions')
    .insert(input)
    .select()
    .single();
}

export async function recordHandheldPickingScan(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_record_handheld_picking_scan', {
    input,
  });
}

export async function completeHandheldPickingSession(id, completedBy = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_complete_handheld_picking_session', {
    p_session_id: id,
    p_completed_by: completedBy,
  });
}

export async function cancelHandheldPickingSession(id, reason) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase
    .from('tgd_handheld_picking_sessions')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}
