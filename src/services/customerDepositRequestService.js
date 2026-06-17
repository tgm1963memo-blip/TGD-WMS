import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';

const DEPOSIT_HEADER_SELECT = [
  'id',
  'request_no',
  'customer_id',
  'status',
  'expected_arrival_date',
  'contact_name',
  'contact_phone',
  'note',
  'vehicle_registration',
  'created_by_email',
  'created_by_role',
  'submitted_at',
  'reviewed_at',
  'review_comment',
  'last_action_by_email',
  'last_action_at',
  'created_at',
  'updated_at',
].join(', ');

const DEPOSIT_LINE_SELECT = [
  'id',
  'deposit_request_id',
  'line_no',
  'customer_product_code',
  'internal_product_code',
  'product_id',
  'product_name',
  'lot_no',
  'mfg_date',
  'exp_date',
  'expected_qty',
  'expected_boxes',
  'expected_weight',
  'weight_per_box',
  'uom',
  'temperature_type',
  'note',
  'created_at',
].join(', ');

export async function listCustomerDepositRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customer_deposit_requests')
    .select(DEPOSIT_HEADER_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.statusIn?.length) query = query.in('status', filters.statusIn);

  return query;
}

export async function getCustomerDepositRequest(requestId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_deposit_requests')
    .select(DEPOSIT_HEADER_SELECT)
    .eq('id', requestId)
    .maybeSingle();
}

export async function listCustomerDepositRequestLines(requestId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_deposit_request_lines')
    .select(DEPOSIT_LINE_SELECT)
    .eq('deposit_request_id', requestId)
    .order('line_no', { ascending: true });
}

export async function createCustomerDepositRequest({
  expectedArrivalDate,
  contactName,
  contactPhone,
  note,
  vehicleRegistration,
  customerId = null,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_create_customer_deposit_request', {
    p_expected_arrival_date: expectedArrivalDate,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_note: toNullableText(note),
    p_vehicle_registration: toNullableText(vehicleRegistration),
    p_customer_id: customerId,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function updateCustomerDepositRequestDraft(requestId, {
  expectedArrivalDate,
  contactName,
  contactPhone,
  note,
  vehicleRegistration,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_customer_deposit_request_draft', {
    p_request_id: requestId,
    p_expected_arrival_date: expectedArrivalDate,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_note: toNullableText(note),
    p_vehicle_registration: toNullableText(vehicleRegistration),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function upsertCustomerDepositRequestLine(requestId, line = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_upsert_customer_deposit_request_line', {
    p_request_id: requestId,
    p_line_id: line.lineId ?? null,
    p_line_no: line.lineNo ?? null,
    p_customer_product_code: toNullableText(line.customerProductCode),
    p_internal_product_code: toNullableText(line.internalProductCode),
    p_product_id: line.productId ?? null,
    p_product_name: toNullableText(line.productName),
    p_lot_no: toNullableText(line.lotNo),
    p_mfg_date: line.mfgDate || null,
    p_exp_date: line.expDate || null,
    p_expected_qty: toNullableNumber(line.expectedQty),
    p_expected_boxes: toNullableNumber(line.expectedBoxes),
    p_expected_weight: toNullableNumber(line.expectedWeight),
    p_weight_per_box: toNullableNumber(line.weightPerBox),
    p_uom: toNullableText(line.uom),
    p_temperature_type: toNullableText(line.temperatureType),
    p_note: toNullableText(line.note),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function deleteCustomerDepositRequestLine(requestId, lineId) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_delete_customer_deposit_request_line', {
    p_request_id: requestId,
    p_line_id: lineId,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function submitCustomerDepositRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_submit_customer_deposit_request', {
    p_request_id: requestId,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function reviewCustomerDepositRequest(requestId, decision, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_review_customer_deposit_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function cancelCustomerDepositRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_cancel_customer_deposit_request', {
    p_request_id: requestId,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function enqueueCustomerDepositNotification(requestId, customerId, documentNo, submitterEmail = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_enqueue_customer_request_notifications', {
    p_document_type: 'DEPOSIT',
    p_document_id: requestId,
    p_customer_id: customerId,
    p_document_no: documentNo,
    p_submitter_email: submitterEmail ?? null,
  });

  return { data, error };
}
