import { supabase } from './supabaseClient.js';
import { missingSupabaseClientResult } from './customerPortalServiceUtils.js';

// Seal number and receiving driver's name on deposits / withdrawals
// (migration 20261124110000_transport_seal_driver.sql). Read on their own,
// rather than added to the header list selects, so the document lists keep
// working on a database where the migration has not been applied yet.

export const TRANSPORT_DOCUMENT_TABLES = {
  CUSTOMER_DEPOSIT_REQUEST: 'tgd_customer_deposit_requests',
  CUSTOMER_WITHDRAWAL_REQUEST: 'tgd_customer_withdrawal_requests',
};

const EMPTY = { seal_no: null, driver_name: null, transport_info_set_by_email: null, transport_info_set_at: null };

function isMissingColumn(error) {
  return /column .* does not exist|Could not find .* column/i.test(error?.message ?? '');
}

export async function getDocumentTransportInfo(documentType, requestId) {
  if (!supabase) return missingSupabaseClientResult();
  const table = TRANSPORT_DOCUMENT_TABLES[documentType];
  if (!table || !requestId) return { data: { ...EMPTY }, error: null, unavailable: false };

  const { data, error } = await supabase
    .from(table)
    .select('id, seal_no, driver_name, transport_info_set_by_email, transport_info_set_at')
    .eq('id', requestId)
    .maybeSingle();

  if (isMissingColumn(error)) return { data: { ...EMPTY }, error: null, unavailable: true };
  return { data: data ?? { ...EMPTY }, error, unavailable: false };
}

export async function setDocumentTransportInfo(documentType, requestId, { sealNo, driverName } = {}) {
  if (!supabase) return missingSupabaseClientResult();
  const clean = (v) => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const { data, error } = await supabase.rpc('tgd_set_document_transport_info', {
    p_document_type: documentType,
    p_request_id: requestId,
    p_seal_no: clean(sealNo),
    p_driver_name: clean(driverName),
  });
  return { data, error };
}
