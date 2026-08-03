import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';
import { getDepositInventoryLines } from './customerDepositRequestService.js';

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
  'requires_r3_document',
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
  'pack_entry_mode',
  'picked_boxes',
  'picked_weight',
  'picked_at',
  'picked_by_email',
  'created_at',
].join(', ');

// A hardcoded .limit(100) here silently dropped any request older than
// the 100 most recent matches — e.g. CWR-20260704-0014 (COMPLETED,
// otherwise a normal match for REVIEW_STATUSES) had 186 newer requests
// ahead of it, so it never even reached CustomerAdminWithdrawalReviewPage's
// `rows` state for the search box to find, with no error shown anywhere.
// created_at is set once at insert and never mutated, so plain offset
// pagination (unlike the last_action_at-ordered case fixed elsewhere in
// this codebase) can't drift a row out of view between pages.
export async function listCustomerWithdrawalRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const PAGE_SIZE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('tgd_customer_withdrawal_requests')
      .select(WITHDRAWAL_HEADER_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (filters.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.statusIn?.length) query = query.in('status', filters.statusIn);

    const { data: page, error } = await query;
    if (error) return { data: null, error };
    rows.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
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

  return { ...result, data: await attachRemainingLotBalance(result.data, requestRow?.customer_id ?? null, requestId) };
}

// For each line's source deposit batch, resolves how many boxes/kg remain
// in that batch and its storage location code — so the printed pick/
// delivery document can show staff what's left in that lot and where it's
// stored.
//
// The remaining quantity itself is read via getDepositInventoryLines, which
// nets a batch's raw deposited quantity against EVERY non-CANCELLED
// withdrawal line claiming it (matched by source_customer_deposit_request_
// line_id, else tracking code) — the same "claimed balance" definition the
// withdrawal-creation page already uses to warn customers before they
// submit. This function used to read tgd_get_customer_stock_balance
// instead, which only nets out withdrawals whose request has already
// reached COMPLETED — so two withdrawal slips submitted back-to-back
// against the same lot, neither yet completed, each computed "remaining"
// against the same un-decremented baseline and both printed a nonzero
// balance even once the lot was fully claimed between them. Real incident:
// CWR-20260725-0006 printed "20 remaining" (200 kg) for tracking
// FR260716050/lot API — CWR-20260725-0005, submitted ~50s earlier and still
// WAREHOUSE_PICKING, had already claimed 20 of the lot's 84 boxes, so once
// 0006's own 64-box claim is netted out on top (below), 0 should have shown.
// excludeWithdrawalRequestId keeps this document's own line(s) out of the
// "claimed by others" sum — the caller already nets those out itself via
// each line's own picked/requested quantity.
//
// Batch resolution still happens locally, in priority order: direct
// source_customer_deposit_request_line_id link, else the line's tracking
// code (unique per deposit line), else lot_no + customer_product_code —
// the last of which is inherently ambiguous when a LOT spans multiple
// deposit lines, so it just picks one sibling to represent for display;
// the *quantity* shown for it is still that specific sibling's correct,
// already-netted balance, not a re-derived approximation.
async function attachRemainingLotBalance(lines, customerId, requestId) {
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
    getDepositInventoryLines({ customerId, excludeWithdrawalRequestId: requestId }),
  ]);

  const depositLineList = (depositRequests ?? []).flatMap((r) => r.tgd_customer_deposit_request_lines ?? []);
  if (depositLineList.length === 0) {
    return lines.map((l) => ({ ...l, lot_remaining_boxes: null, lot_remaining_weight: null, resolved_weight_per_box: null }));
  }

  const depositLineById = new Map(depositLineList.map((d) => [d.id, d]));
  // getDepositInventoryLines only covers deposit requests still in
  // RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED (unlike the broader COMPLETED-
  // inclusive status list above), so a resolved line missing here belongs to
  // an already-COMPLETED deposit request — correctly reported as 0, not
  // null, since a completed deposit has nothing left to withdraw from.
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
  requiresR3Document = false,
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
    p_requires_r3_document: Boolean(requiresR3Document),
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
  requiresR3Document = false,
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
    p_requires_r3_document: Boolean(requiresR3Document),
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
    p_pack_entry_mode: toNullableText(line.packEntryMode),
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

// Replaces the old bare tracking_code-only update (no role check at all).
// When trackingCode is given, the RPC re-derives customer_product_code/
// lot_no/source_customer_deposit_request_(line_)id from whatever deposit
// lot that tracking code actually belongs to (globally unique), rejecting
// the whole update if no such lot exists or it belongs to a different
// customer -- so admin can't silently desync a withdrawal line's displayed
// product/lot from the tracking code it's supposed to match. A direct edit
// to customerProductCode/lotNo (trackingCode omitted) stays plain free text.
export async function updateWithdrawalLineSource(lineId, { customerProductCode, lotNo, trackingCode } = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_admin_update_withdrawal_line_source', {
    p_line_id: lineId,
    p_customer_product_code: customerProductCode ?? null,
    p_lot_no: lotNo ?? null,
    p_tracking_code: trackingCode ?? null,
  });

  return { data, error };
}

// Lets warehouse/admin staff add a brand-new line to a request that's
// already ADMIN_ACCEPTED/WAREHOUSE_PICKING — for when the notified lot
// doesn't have enough stock and the shortfall needs a SEPARATE line
// sourced from a different lot/tracking code, not just a retag of the
// one existing line (see tgd_admin_add_customer_withdrawal_request_line,
// migration 20260801100000).
export async function addAdminWithdrawalRequestLine(withdrawalRequestId, {
  customerProductCode,
  trackingCode = null,
  lotNo = null,
  productName = null,
  requestedBoxes = null,
  requestedWeight = null,
  note = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_admin_add_customer_withdrawal_request_line', {
    p_withdrawal_request_id: withdrawalRequestId,
    p_customer_product_code: toNullableText(customerProductCode),
    p_tracking_code: toNullableText(trackingCode),
    p_lot_no: toNullableText(lotNo),
    p_product_name: toNullableText(productName),
    p_requested_boxes: toNullableNumber(requestedBoxes),
    p_requested_weight: toNullableNumber(requestedWeight),
    p_note: toNullableText(note),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
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
