import { supabase } from './supabaseClient.js';
import { missingSupabaseClientResult } from './customerPortalServiceUtils.js';

export async function listCustomerDocumentTimelineEvents(documentType, documentId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_document_timeline_events')
    .select('id, document_type, document_id, customer_id, action, from_status, to_status, actor_email, actor_role, comment, metadata_json, created_at')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
}
