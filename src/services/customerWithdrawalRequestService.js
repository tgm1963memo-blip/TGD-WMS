import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';
import { getCustomerStockBalance } from './customerDepositRequestService.js';

const WITHDRAWAL_HEADER_SELECT = [
  'id',
  'withdrawal_no',
  'customer_id',
  'customer:tgd_customers(customer_code, customer_name, name, address, phone)',
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

  const { data: requestRow } = await supabase
    .from('tgd_customer_withdrawal_requests')
    .select('customer_id')
    .eq('id', requestId)
    .maybeSingle();

  return { ...result, data: await attachRemainingLotBalance(result.data, requestRow?.customer_id ?? null) };
}

// For each line's source deposit batch, resolves how many boxes/kg remain
// in that batch and its storage location code — so the printed pick/
// delivery document can show staff what's left in that lot and where it's
// stored.
//
// The remaining quantity itself is read straight from
// tgd_get_customer_stock_balance (same RPC — and same fixed FIFO/tracking-
// code allocation, see migration 112 — that powers the admin "ยอดคงเหลือ"
// screen), rather than re-deriving it here from raw withdrawal rows. An
// earlier version of this function re-summed withdrawals itself, keyed
// strictly by each withdrawal line's own source_customer_deposit_request_
// line_id — but most existing withdrawal lines never have that column
// populated (see migration 112's investigation), so it silently summed to
// zero and always reported the batch's full original quantity as
// "remaining" even after it had been mostly withdrawn. Reusing the RPC
// avoids maintaining two separate (and now provably inconsistent)
// implementations of the same balance calculation.
//
// Batch resolution still happens locally, in priority order: direct
// source_customer_deposit_request_line_id link, else the line's tracking
// code (unique per deposit line), else lot_no + customer_product_code —
// the last of which is inherently ambiguous when a LOT spans multiple
// deposit lines, so it just picks one sibling to represent for display;
// the *quantity* shown for it is still that specific sibling's correct,
// FIFO-allocated balance from the RPC, not a re-derived approximation.
async function attachRemainingLotBalance(lines, customerId) {
  if (!supabase || !customerId) {
    return lines.map((l) => ({ ...l, lot_remaining_boxes: null, lot_remaining_weight: null, resolved_weight_per_box: null }));
  }

  const [{ data: depositRequests }, { data: balances }] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_requests')
      .select(`
        id,
        tgd_customer_deposit_request_lines(
          id, lot_no, tracking_code, customer_product_code, actual_boxes, actual_weight,
          expected_boxes, expected_weight, weight_per_box, location_id, tgd_locations(location_code)
        )
      `)
      .eq('customer_id', customerId)
      .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED']),
    getCustomerStockBalance(customerId),
  ]);

  const depositLineList = (depositRequests ?? []).flatMap((r) => r.tgd_customer_deposit_request_lines ?? []);
  if (depositLineList.length === 0) {
    return lines.map((l) => ({ ...l, lot_remaining_boxes: null, lot_remaining_weight: null, resolved_weight_per_box: null }));
  }

  const depositLineById = new Map(depositLineList.map((d) => [d.id, d]));
  // Balance rows only cover lines with a positive remaining balance (the
  // RPC filters out zero-balance lines), so a resolved line missing here
  // means it's fully withdrawn — correctly reported as 0, not null.
  const balanceByLineId = new Map((balances ?? []).map((b) => [b.id, b]));

  function resolveDepositLine(line) {
    if (line.source_customer_deposit_request_line_id) {
      const direct = depositLineById.get(line.source_customer_deposit_request_line_id);
      if (direct) return direct;
    }
    if (line.tracking_code) {
      const byTracking = depositLineList.find((d) => d.tracking_code === line.tracking_code);
      if (byTracking) return byTracking;
    }
    const lotNo = line.lot_no ?? line.source_lot_no ?? null;
    if (!lotNo) return null;
    const lotMatches = depositLineList.filter((d) =>
      (d.lot_no ?? '') === lotNo &&
      (!line.customer_product_code || d.customer_product_code === line.customer_product_code)
    );
    if (lotMatches.length <= 1) return lotMatches[0] ?? null;

    // A LOT can span more than one deposit line — several receiving
    // batches/tracking codes, each with its own real weight_per_box (a lot
    // spanning e.g. a 5kg/box batch and a 9.8kg/box batch is a real,
    // observed case — see the balance-lock migration's incident notes).
    // Blindly taking the first lot-mate here previously meant a withdrawal
    // line resolved by LOT alone (no tracking_code recorded on it, e.g. an
    // older pre-migration row) could get an unrelated batch's
    // weight_per_box, so the "average weight" shown/used for it wouldn't
    // match the tracking code it actually came from. Prefer whichever
    // lot-mate can actually cover this line's own requested/picked
    // quantity, tie-broken by the smallest sufficient remaining balance —
    // the same disambiguation getMatchedDepositLine uses client-side for
    // the same reason.
    const wantBoxes = Number(line.picked_boxes ?? line.requested_boxes) || 0;
    const wantWeight = Number(line.picked_weight ?? line.requested_weight) || 0;
    const fits = lotMatches.filter((d) => {
      const boxBal = Number(d.actual_boxes ?? d.expected_boxes ?? 0);
      const wtBal = Number(d.actual_weight ?? d.expected_weight ?? 0);
      return (wantBoxes <= 0 || boxBal >= wantBoxes) && (wantWeight <= 0 || wtBal >= wantWeight);
    });
    const candidates = fits.length ? fits : lotMatches;
    return candidates.reduce((best, d) => {
      const bestBal = Number(best.actual_boxes ?? best.expected_boxes ?? 0);
      const dBal = Number(d.actual_boxes ?? d.expected_boxes ?? 0);
      return dBal < bestBal ? d : best;
    });
  }

  return lines.map((line) => {
    const depositLine = resolveDepositLine(line);
    if (!depositLine) {
      return { ...line, lot_remaining_boxes: null, lot_remaining_weight: null, resolved_weight_per_box: null };
    }
    const balance = balanceByLineId.get(depositLine.id);
    return {
      ...line,
      location: depositLine.tgd_locations?.location_code ?? line.location ?? null,
      lot_remaining_boxes: Number(balance?.actual_boxes ?? 0),
      lot_remaining_weight: Number(balance?.actual_weight ?? 0),
      resolved_weight_per_box: depositLine.weight_per_box != null ? Number(depositLine.weight_per_box) : null,
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

// Pulls a submitted withdrawal request back to WITHDRAWAL_DRAFT so the
// customer can edit it — only valid while still awaiting admin review (see
// the RPC for the exact status guard); once accepted into a warehouse
// picking document there's no going back. Mirrors
// recallCustomerDepositRequest in customerDepositRequestService.js.
export async function recallCustomerWithdrawalRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_recall_customer_withdrawal_request', {
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

export async function updateWithdrawalLineTrackingCode(lineId, trackingCode) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase
    .from('tgd_customer_withdrawal_request_lines')
    .update({ tracking_code: toNullableText(trackingCode) })
    .eq('id', lineId)
    .select();

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
