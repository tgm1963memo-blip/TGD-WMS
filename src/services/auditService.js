import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function writeAuditLog(input) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  return supabase.rpc('tgd_write_audit_log', { input });
}

export async function getAuditLogs(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.performedBy) {
    query = query.eq('performed_by', filters.performedBy);
  }

  if (filters.performedByAuthUserId) {
    query = query.eq('performed_by_auth_user_id', filters.performedByAuthUserId);
  }

  if (filters.requestId) {
    query = query.eq('request_id', filters.requestId);
  }

  return query;
}

