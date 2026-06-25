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
  'customer:tgd_customers(name_th, name_en)',
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
  'handheld_received_by_email',
  'web_approved_by_email',
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
  'actual_boxes',
  'actual_weight',
  'actual_note',
  'location_id',
  'created_at',
].join(', ');

export async function listCustomerDepositRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customer_deposit_requests')
    .select(DEPOSIT_HEADER_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.statusIn?.length) query = query.in('status', filters.statusIn);

  return query;
}

export async function getDepositInventoryLines(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const RECEIVED_STATUSES = ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'];

  // Step 1: load received CDR headers (optionally filtered by customer)
  let hdrQuery = supabase
    .from('tgd_customer_deposit_requests')
    .select('id, request_no, customer_id, status, expected_arrival_date, reviewed_at, last_action_at')
    .in('status', RECEIVED_STATUSES)
    .order('last_action_at', { ascending: false })
    .limit(500);

  if (filters.customerId) hdrQuery = hdrQuery.eq('customer_id', filters.customerId);

  const { data: headers, error: hErr } = await hdrQuery;
  if (hErr) return { data: null, error: hErr };
  if (!headers?.length) return { data: [], error: null };

  const ids = headers.map((h) => h.id);

  // Step 2: load all lines for those CDRs
  const { data: lines, error: lErr } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, deposit_request_id, line_no, customer_product_code, product_name, lot_no, mfg_date, exp_date, expected_boxes, expected_weight, actual_boxes, actual_weight, actual_note, uom, temperature_type')
    .in('deposit_request_id', ids)
    .order('line_no', { ascending: true });

  if (lErr) return { data: null, error: lErr };

  // Step 3: join in-memory
  const headerMap = Object.fromEntries(headers.map((h) => [h.id, h]));
  const enriched = (lines ?? []).map((l) => ({
    ...l,
    request: headerMap[l.deposit_request_id] ?? null,
  }));

  return { data: enriched, error: null };
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

export async function recordDepositLineActualReceipt(lineId, {
  actualBoxes,
  actualWeight,
  note = null,
  lotNo = null,
  mfgDate = null,
  expDate = null,
  locationId = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_record_deposit_line_actual_receipt', {
    p_line_id: lineId,
    p_actual_boxes: toNullableNumber(actualBoxes),
    p_actual_weight: toNullableNumber(actualWeight),
    p_note: toNullableText(note),
    p_lot_no: toNullableText(lotNo),
    p_mfg_date: mfgDate || null,
    p_exp_date: expDate || null,
    p_location_id: locationId || null,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

// Update only the location on a deposit line — preserves actual_boxes/actual_weight unchanged
export async function updateDepositLineLocation(lineId, locationId, existingLine = {}) {
  return recordDepositLineActualReceipt(lineId, {
    actualBoxes: existingLine.actual_boxes,
    actualWeight: existingLine.actual_weight,
    note: existingLine.actual_note,
    lotNo: existingLine.lot_no,
    mfgDate: existingLine.mfg_date,
    expDate: existingLine.exp_date,
    locationId,
  });
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
