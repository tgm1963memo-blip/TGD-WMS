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
  'customer:tgd_customers(customer_code, customer_name, name, address, phone)',
  'status',
  'expected_arrival_date',
  'contact_name',
  'contact_phone',
  'note',
  'vehicle_registration',
  'arrival_time',
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
  'has_receipt_variance',
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
  'tracking_code',
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
  'location:tgd_locations(location_code)',
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

export async function getCustomerStockBalance(customerId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId) return { data: [], error: null };

  const { data, error } = await supabase.rpc('tgd_get_customer_stock_balance', {
    p_customer_id: customerId,
  });

  if (error) return { data: null, error };

  // Wrap each row so it has a `request` object matching the shape CustomerStockBalancePage expects
  const rows = (Array.isArray(data) ? data : []).map((r) => ({
    ...r,
    id: r.deposit_line_id,
    request: {
      request_no: r.request_no,
      last_action_at: r.received_at,
      expected_arrival_date: r.received_at,
    },
    // expose balance values as the display columns
    actual_boxes: r.balance_boxes,
    actual_weight: r.balance_weight,
    note: r.note,
    actual_note: r.actual_note,
  }));

  return { data: rows, error: null };
}

export async function getAllCustomerStockBalances() {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_get_all_customer_stock_balances');
  if (error) return { data: null, error };

  const rows = (Array.isArray(data) ? data : []).map((r) => ({
    ...r,
    id: r.deposit_line_id,
    request: {
      id: r.deposit_request_id,
      request_no: r.request_no,
      customer_id: r.customer_id,
      last_action_at: r.received_at,
      expected_arrival_date: r.received_at,
    },
    actual_boxes: r.balance_boxes,
    actual_weight: r.balance_weight,
    note: r.note,
    actual_note: r.actual_note,
  }));

  return { data: rows, error: null };
}

export async function getDepositInventoryLines(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const RECEIVED_STATUSES = ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'];

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

  const { data: lines, error: lErr } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, deposit_request_id, line_no, customer_product_code, product_name, lot_no, tracking_code, mfg_date, exp_date, expected_boxes, expected_weight, actual_boxes, actual_weight, actual_note, uom, temperature_type, weight_per_box')
    .in('deposit_request_id', ids)
    .order('line_no', { ascending: true });

  if (lErr) return { data: null, error: lErr };

  // actual_boxes/actual_weight above are the RAW deposited totals, not what's
  // left after prior withdrawals. The withdrawal-request create page uses
  // this as its balance-check baseline (getWithdrawalBalanceInfo), so without
  // netting out already-claimed quantities here it silently compares a new
  // request against the full original deposit instead of the true remaining
  // balance — the same balance the server-side lock in
  // tgd_upsert_customer_withdrawal_request_line already enforces. Mirror that
  // RPC's "claimed" computation (same deposit line id OR same tracking code,
  // any non-CANCELLED withdrawal request) so the client warns before the
  // server has to reject it.
  const lineIds = (lines ?? []).map((l) => l.id);
  const trackingCodes = [...new Set((lines ?? []).map((l) => l.tracking_code).filter(Boolean))];

  let claimedQuery = supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select('source_customer_deposit_request_line_id, tracking_code, requested_boxes, requested_weight, withdrawal_request_id, tgd_customer_withdrawal_requests!inner(status)')
    .neq('tgd_customer_withdrawal_requests.status', 'CANCELLED');

  if (filters.excludeWithdrawalRequestId) {
    claimedQuery = claimedQuery.neq('withdrawal_request_id', filters.excludeWithdrawalRequestId);
  }

  const orParts = [];
  if (lineIds.length) orParts.push(`source_customer_deposit_request_line_id.in.(${lineIds.join(',')})`);
  if (trackingCodes.length) orParts.push(`tracking_code.in.(${trackingCodes.map((c) => `"${c}"`).join(',')})`);

  const claimedByLineId = {};
  const claimedByTrackingCode = {};
  if (orParts.length) {
    const { data: claimedLines, error: cErr } = await claimedQuery.or(orParts.join(','));
    if (cErr) return { data: null, error: cErr };
    for (const cl of claimedLines ?? []) {
      if (cl.source_customer_deposit_request_line_id) {
        const bucket = claimedByLineId[cl.source_customer_deposit_request_line_id] ?? { boxes: 0, weight: 0 };
        bucket.boxes += Number(cl.requested_boxes) || 0;
        bucket.weight += Number(cl.requested_weight) || 0;
        claimedByLineId[cl.source_customer_deposit_request_line_id] = bucket;
      }
      if (cl.tracking_code) {
        const bucket = claimedByTrackingCode[cl.tracking_code] ?? { boxes: 0, weight: 0 };
        bucket.boxes += Number(cl.requested_boxes) || 0;
        bucket.weight += Number(cl.requested_weight) || 0;
        claimedByTrackingCode[cl.tracking_code] = bucket;
      }
    }
  }

  const headerMap = Object.fromEntries(headers.map((h) => [h.id, h]));
  const enriched = (lines ?? []).map((l) => {
    // A line matched by id and by tracking_code could double-count the same
    // withdrawal row if it satisfies both — dedupe isn't needed here since
    // both buckets are summed from the SAME underlying rows independently
    // per deposit line, and every withdrawal row is attributed to exactly
    // one deposit line in practice, so take whichever bucket is non-empty.
    const claimed = claimedByLineId[l.id] ?? claimedByTrackingCode[l.tracking_code] ?? { boxes: 0, weight: 0 };
    const rawBoxes = Number(l.actual_boxes) || 0;
    const rawWeight = Number(l.actual_weight) || 0;
    return {
      ...l,
      request: headerMap[l.deposit_request_id] ?? null,
      actual_boxes: Math.max(0, rawBoxes - claimed.boxes),
      actual_weight: Math.max(0, rawWeight - claimed.weight),
    };
  });

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

export async function listDepositLineSummariesForDocs(docIds) {
  if (!supabase || !docIds?.length) return { data: [], error: null };
  return supabase
    .from('tgd_customer_deposit_request_lines')
    .select('deposit_request_id, lot_no, exp_date')
    .in('deposit_request_id', docIds);
}

export async function createCustomerDepositRequest({
  expectedArrivalDate,
  contactName,
  contactPhone,
  note,
  vehicleRegistration,
  arrivalTime,
  customerId = null,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_create_customer_deposit_request', {
    p_expected_arrival_date: expectedArrivalDate,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_note: toNullableText(note),
    p_vehicle_registration: toNullableText(vehicleRegistration),
    p_arrival_time: toNullableText(arrivalTime),
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
  arrivalTime,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_customer_deposit_request_draft', {
    p_request_id: requestId,
    p_expected_arrival_date: expectedArrivalDate,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_note: toNullableText(note),
    p_vehicle_registration: toNullableText(vehicleRegistration),
    p_arrival_time: toNullableText(arrivalTime),
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

// Auxiliary per-request services (container reefer plug-in, overnight flat
// fee, etc.) — selected at deposit time but billed separately from the
// automatic weight-based storage engine (see billingRateCalc.js).
export async function listCustomerDepositRequestServices(requestId) {
  if (!supabase) return missingSupabaseClientResult();
  return supabase
    .from('tgd_customer_deposit_request_services')
    .select('id, deposit_request_id, service_rate_id, quantity, note')
    .eq('deposit_request_id', requestId);
}

export async function upsertCustomerDepositRequestService(requestId, { id = null, serviceRateId, quantity = 1, note = null } = {}) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_upsert_customer_deposit_request_service', {
    p_deposit_request_id: requestId,
    p_service_rate_id: serviceRateId,
    p_quantity: toNullableNumber(quantity) ?? 1,
    p_note: toNullableText(note),
    p_id: id,
  });
  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function deleteCustomerDepositRequestService(id) {
  if (!supabase) return missingSupabaseClientResult();
  const { data, error } = await supabase.rpc('tgd_delete_customer_deposit_request_service', { p_id: id });
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

export async function enqueueDepositRecountNotification(requestId, customerId, documentNo, requestorEmail = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_enqueue_customer_request_notifications', {
    p_document_type: 'DEPOSIT',
    p_document_id: requestId,
    p_customer_id: customerId,
    p_document_no: documentNo,
    p_submitter_email: requestorEmail ?? null,
    p_notification_event: 'RECOUNT_REQUESTED',
  });

  return { data, error };
}
