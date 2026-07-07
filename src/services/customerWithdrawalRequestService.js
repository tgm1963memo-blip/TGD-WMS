import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';

const WITHDRAWAL_HEADER_SELECT = [
  'id',
  'withdrawal_no',
  'customer_id',
  'customer:tgd_customers(customer_code, customer_name, name)',
  'status',
  'requested_dispatch_date',
  'delivery_type',
  'pickup_contact',
  'destination',
  'vehicle_registration',
  'note',
  'created_by_email',
  'created_by_role',
  'submitted_at',
  'reviewed_at',
  'review_comment',
  'last_action_by_email',
  'last_action_at',
  'web_approved_by_email',
  'created_at',
  'updated_at',
].join(', ');

const WITHDRAWAL_LINE_SELECT = [
  'id',
  'withdrawal_request_id',
  'line_no',
  'source_customer_deposit_request_id',
  'source_customer_deposit_request_line_id',
  'source_lot_no',
  'tracking_code',
  'customer_product_code',
  'internal_product_code',
  'product_id',
  'product_name',
  'lot_no',
  'mfg_date',
  'exp_date',
  'requested_qty',
  'requested_boxes',
  'requested_weight',
  'uom',
  'picking_rule',
  'note',
  'admin_note',
  'picked_boxes',
  'picked_weight',
  'picked_at',
  'picked_by_email',
  'created_at',
].join(', ');

export async function listCustomerWithdrawalRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customer_withdrawal_requests')
    .select(WITHDRAWAL_HEADER_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.statusIn?.length) query = query.in('status', filters.statusIn);

  return query;
}

export async function getCustomerWithdrawalRequest(requestId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_withdrawal_requests')
    .select(WITHDRAWAL_HEADER_SELECT)
    .eq('id', requestId)
    .maybeSingle();
}

export async function listCustomerWithdrawalRequestLines(requestId) {
  if (!supabase) return missingSupabaseClientResult();

  const result = await supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select(WITHDRAWAL_LINE_SELECT)
    .eq('withdrawal_request_id', requestId)
    .order('line_no', { ascending: true });

  if (result.error || !result.data?.length) return result;

  return { ...result, data: await attachRemainingLotBalance(result.data) };
}

// For each line's source deposit batch (the specific lot it was picked
// from, via source_customer_deposit_request_line_id), computes how many
// boxes/kg remain in that batch: its total received quantity minus
// everything ever picked from it across COMPLETED withdrawals — so the
// printed pick/delivery document can show staff what's left in that lot.
// Lines with no direct source link (older data, or matched by lot fallback
// only) get null — there's no single deposit line to measure against.
async function attachRemainingLotBalance(lines) {
  const depositLineIds = [...new Set(
    lines.map((l) => l.source_customer_deposit_request_line_id).filter(Boolean)
  )];

  if (!supabase || depositLineIds.length === 0) {
    return lines.map((l) => ({ ...l, lot_remaining_boxes: null, lot_remaining_weight: null }));
  }

  const [depositLinesResult, withdrawnLinesResult] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_request_lines')
      .select('id, actual_boxes, actual_weight, expected_boxes, expected_weight')
      .in('id', depositLineIds),
    supabase
      .from('tgd_customer_withdrawal_request_lines')
      .select('source_customer_deposit_request_line_id, picked_boxes, picked_weight, withdrawal_request_id')
      .in('source_customer_deposit_request_line_id', depositLineIds),
  ]);

  const withdrawnLines = withdrawnLinesResult.data ?? [];
  const withdrawalRequestIds = [...new Set(withdrawnLines.map((r) => r.withdrawal_request_id).filter(Boolean))];

  const { data: withdrawalRequests } = withdrawalRequestIds.length
    ? await supabase.from('tgd_customer_withdrawal_requests').select('id, status').in('id', withdrawalRequestIds)
    : { data: [] };
  const statusByRequestId = new Map((withdrawalRequests ?? []).map((r) => [r.id, r.status]));

  const depositLineMap = new Map((depositLinesResult.data ?? []).map((d) => [d.id, d]));

  const withdrawnByDepositLine = new Map();
  for (const row of withdrawnLines) {
    if (statusByRequestId.get(row.withdrawal_request_id) !== 'COMPLETED') continue;
    const key = row.source_customer_deposit_request_line_id;
    const cur = withdrawnByDepositLine.get(key) ?? { boxes: 0, weight: 0 };
    cur.boxes += Number(row.picked_boxes ?? 0);
    cur.weight += Number(row.picked_weight ?? 0);
    withdrawnByDepositLine.set(key, cur);
  }

  return lines.map((line) => {
    const depositLine = line.source_customer_deposit_request_line_id
      ? depositLineMap.get(line.source_customer_deposit_request_line_id)
      : null;
    if (!depositLine) {
      return { ...line, lot_remaining_boxes: null, lot_remaining_weight: null };
    }
    const totalBoxes = Number(depositLine.actual_boxes ?? depositLine.expected_boxes ?? 0);
    const totalWeight = Number(depositLine.actual_weight ?? depositLine.expected_weight ?? 0);
    const withdrawn = withdrawnByDepositLine.get(line.source_customer_deposit_request_line_id) ?? { boxes: 0, weight: 0 };
    return {
      ...line,
      lot_remaining_boxes: Math.max(0, totalBoxes - withdrawn.boxes),
      lot_remaining_weight: Math.max(0, totalWeight - withdrawn.weight),
    };
  });
}

export async function listWithdrawalLineSummariesForDocs(docIds) {
  if (!supabase || !docIds?.length) return { data: [], error: null };
  return supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select('withdrawal_request_id, lot_no, exp_date')
    .in('withdrawal_request_id', docIds);
}

export async function createCustomerWithdrawalRequest({
  requestedDispatchDate,
  deliveryType,
  pickupContact,
  destination,
  note,
  vehicleRegistration,
  customerId = null,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_create_customer_withdrawal_request', {
    p_requested_dispatch_date: requestedDispatchDate,
    p_delivery_type: deliveryType,
    p_pickup_contact: pickupContact,
    p_destination: toNullableText(destination),
    p_note: toNullableText(note),
    p_customer_id: customerId,
    p_vehicle_registration: toNullableText(vehicleRegistration),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function updateCustomerWithdrawalRequestDraft(requestId, {
  requestedDispatchDate,
  deliveryType,
  pickupContact,
  destination,
  note,
  vehicleRegistration,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_customer_withdrawal_request_draft', {
    p_request_id: requestId,
    p_requested_dispatch_date: requestedDispatchDate,
    p_delivery_type: deliveryType,
    p_pickup_contact: pickupContact,
    p_destination: toNullableText(destination),
    p_note: toNullableText(note),
    p_vehicle_registration: toNullableText(vehicleRegistration),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function upsertCustomerWithdrawalRequestLine(requestId, line = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_upsert_customer_withdrawal_request_line', {
    p_request_id: requestId,
    p_line_id: line.lineId ?? null,
    p_line_no: line.lineNo ?? null,
    p_source_customer_deposit_request_id: line.sourceDepositRequestId ?? null,
    p_source_customer_deposit_request_line_id: line.sourceDepositRequestLineId ?? null,
    p_source_lot_no: toNullableText(line.sourceLotNo),
    p_tracking_code: toNullableText(line.trackingCode),
    p_customer_product_code: toNullableText(line.customerProductCode),
    p_internal_product_code: toNullableText(line.internalProductCode),
    p_product_id: line.productId ?? null,
    p_product_name: toNullableText(line.productName),
    p_lot_no: toNullableText(line.lotNo),
    p_mfg_date: line.mfgDate || null,
    p_exp_date: line.expDate || null,
    p_requested_qty: toNullableNumber(line.requestedQty),
    p_requested_boxes: toNullableNumber(line.requestedBoxes),
    p_requested_weight: toNullableNumber(line.requestedWeight),
    p_uom: toNullableText(line.uom),
    p_picking_rule: toNullableText(line.pickingRule) ?? 'FEFO',
    p_note: toNullableText(line.note),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function deleteCustomerWithdrawalRequestLine(requestId, lineId) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_delete_customer_withdrawal_request_line', {
    p_request_id: requestId,
    p_line_id: lineId,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function submitCustomerWithdrawalRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_submit_customer_withdrawal_request', {
    p_request_id: requestId,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function reviewCustomerWithdrawalRequest(requestId, decision, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_review_customer_withdrawal_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function cancelCustomerWithdrawalRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_cancel_customer_withdrawal_request', {
    p_request_id: requestId,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function recordWithdrawalLinePick(lineId, pickedBoxes, pickedWeight) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_record_withdrawal_line_pick', {
    p_line_id: lineId,
    p_picked_boxes: pickedBoxes != null ? Number(pickedBoxes) : null,
    p_picked_weight: pickedWeight != null ? Number(pickedWeight) : null,
  });

  return { data, error };
}

export async function updateWithdrawalLineAdminNote(lineId, adminNote) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_withdrawal_line_admin_note', {
    p_line_id: lineId,
    p_admin_note: toNullableText(adminNote),
  });

  return { data, error };
}

export async function enqueueCustomerWithdrawalNotification(requestId, customerId, documentNo, submitterEmail = null, note = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_enqueue_customer_request_notifications', {
    p_document_type: 'CUSTOMER_WITHDRAWAL_REQUEST',
    p_document_id: requestId,
    p_customer_id: customerId,
    p_document_no: documentNo,
    p_submitter_email: submitterEmail ?? null,
    p_notification_event: 'DISPATCH_CONFIRMED',
  });

  return { data, error };
}
