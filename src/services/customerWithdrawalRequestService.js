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
  'status',
  'requested_dispatch_date',
  'delivery_type',
  'pickup_contact',
  'destination',
  'note',
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

const WITHDRAWAL_LINE_SELECT = [
  'id',
  'withdrawal_request_id',
  'line_no',
  'source_customer_deposit_request_id',
  'source_lot_no',
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

  return supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select(WITHDRAWAL_LINE_SELECT)
    .eq('withdrawal_request_id', requestId)
    .order('line_no', { ascending: true });
}

export async function createCustomerWithdrawalRequest({
  requestedDispatchDate,
  deliveryType,
  pickupContact,
  destination,
  note,
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
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function updateCustomerWithdrawalRequestDraft(requestId, {
  requestedDispatchDate,
  deliveryType,
  pickupContact,
  destination,
  note,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_customer_withdrawal_request_draft', {
    p_request_id: requestId,
    p_requested_dispatch_date: requestedDispatchDate,
    p_delivery_type: deliveryType,
    p_pickup_contact: pickupContact,
    p_destination: toNullableText(destination),
    p_note: toNullableText(note),
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
    p_source_lot_no: toNullableText(line.sourceLotNo),
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
