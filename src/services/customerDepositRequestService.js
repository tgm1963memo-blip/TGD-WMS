import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';
import { chunkArray } from './billingRateEngineService.js';

const DEPOSIT_REQUEST_ID_CHUNK_SIZE = 150;

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
  'requires_r3_document',
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
  'pack_entry_mode',
  'actual_boxes',
  'actual_weight',
  'actual_note',
  'location_id',
  'location:tgd_locations(location_code)',
  'created_at',
].join(', ');

// Same fix as listCustomerWithdrawalRequests (customerWithdrawalRequestService.js):
// a fixed .limit(200) would silently drop any request older than the 200
// most recent matches once volume passes that mark, with the admin review
// page's search box then unable to find something that was never fetched
// and no error shown anywhere. created_at is set once at insert and never
// mutated, so plain offset pagination is safe here.
export async function listCustomerDepositRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const PAGE_SIZE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('tgd_customer_deposit_requests')
      .select(DEPOSIT_HEADER_SELECT)
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

// asOfDate (YYYY-MM-DD, optional): shows the balance as it stood at the
// end of that historical day instead of the live current balance — see
// migration 20260801120000 for the exact "confirmed by then / completed
// by then" definition this switches to.
export async function getCustomerStockBalance(customerId, asOfDate = null) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId) return { data: [], error: null };

  const { data, error } = await supabase.rpc('tgd_get_customer_stock_balance', {
    p_customer_id: customerId,
    p_as_of_date: asOfDate || null,
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

export async function getAllCustomerStockBalances(asOfDate = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_get_all_customer_stock_balances', {
    p_as_of_date: asOfDate || null,
  });
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

  // Paginate by `id` (an immutable, unique key) instead of a single
  // .limit(500) ordered by last_action_at. last_action_at is mutable — any
  // admin action on ANY of the customer's other deposit requests bumps it —
  // so a fixed "top 500 by last_action_at" window shifted between calls for
  // customers with 500+ confirmed requests, silently dropping whole deposit
  // headers (and their lines) from the balance computation with no error and
  // no relation to actual stock changing. Looping until exhausted removes the
  // cap entirely rather than picking a bigger arbitrary number.
  const PAGE_SIZE = 1000;
  const headers = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let hdrQuery = supabase
      .from('tgd_customer_deposit_requests')
      .select('id, request_no, customer_id, status, expected_arrival_date, reviewed_at, last_action_at')
      .in('status', RECEIVED_STATUSES)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (filters.customerId) hdrQuery = hdrQuery.eq('customer_id', filters.customerId);

    const { data: page, error: hErr } = await hdrQuery;
    if (hErr) return { data: null, error: hErr };
    headers.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }
  if (!headers.length) return { data: [], error: null };

  const ids = headers.map((h) => h.id);

  // Same failure mode the comments above document for the claimedQuery
  // filter further down: embedding every one of a customer's confirmed
  // deposit request ids into one .in() filter produces a GET URL whose
  // length scales with the customer's history (a real customer has 400+
  // confirmed requests) and can silently fail well past typical URL/
  // header size limits, dropping the balance baseline with no error.
  // Chunk it the same way.
  const lines = [];
  for (const idChunk of chunkArray(ids, DEPOSIT_REQUEST_ID_CHUNK_SIZE)) {
    const { data: chunkLines, error: lErr } = await supabase
      .from('tgd_customer_deposit_request_lines')
      .select('id, deposit_request_id, line_no, customer_product_code, product_name, lot_no, tracking_code, mfg_date, exp_date, expected_boxes, expected_weight, actual_boxes, actual_weight, actual_note, uom, temperature_type, weight_per_box')
      .in('deposit_request_id', idChunk)
      .order('line_no', { ascending: true });

    if (lErr) return { data: null, error: lErr };
    lines.push(...(chunkLines ?? []));
  }

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
  //
  // This used to match by embedding every one of THIS batch's deposit line
  // ids + tracking codes into one .or() filter (source_line_id.in.(id1,id2,
  // ...) — for a customer with hundreds of confirmed deposit lines (a real
  // one has 430+), that produced a single GET request URL tens of thousands
  // of characters long, which silently failed (no rows, and the caller here
  // never even sees an error — see the callers' unguarded .then() with no
  // .catch()) well past typical URL/header size limits. Scoping by this
  // customer's id via the join instead avoids ever building a filter whose
  // size depends on how much history the customer has.
  let claimedQuery = supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select('source_customer_deposit_request_line_id, tracking_code, requested_boxes, requested_weight, picked_boxes, picked_weight, withdrawal_request_id, tgd_customer_withdrawal_requests!inner(status, customer_id, withdrawal_no)')
    .neq('tgd_customer_withdrawal_requests.status', 'CANCELLED');

  if (filters.customerId) {
    claimedQuery = claimedQuery.eq('tgd_customer_withdrawal_requests.customer_id', filters.customerId);
  }
  if (filters.excludeWithdrawalRequestId) {
    claimedQuery = claimedQuery.neq('withdrawal_request_id', filters.excludeWithdrawalRequestId);
  }

  // Real incident this guards against: a deposit line with 417 boxes had a
  // MIX of withdrawal claims against it — some rows carried this line's id
  // directly (source_customer_deposit_request_line_id), others only carried
  // its tracking_code (source id left null) — both are genuine claims
  // against the SAME physical batch. The previous version built two
  // separate totals (claimedByLineId / claimedByTrackingCode) and picked
  // "whichever bucket is non-empty" via `??`, on the assumption that a
  // deposit line would only ever show up in one bucket — false here: the
  // id-bucket had a real but PARTIAL total (195 boxes), so `??` used it
  // instead of falling through to the complete tracking-code total (347),
  // understating what was actually claimed by 152 boxes and overstating
  // this document's printed remaining balance by the same amount (CWR-
  // 20260727-0004 line 3, tracking FR260704036: printed "197 remaining"
  // when the true remaining — matching tgd_get_customer_stock_balance — was
  // 45). Attribute every claimed row to exactly ONE deposit line first
  // (same priority as resolveDepositLine and the RPC's own JOIN condition:
  // direct id, else tracking_code), THEN sum — so a line with claims split
  // across both matching styles gets the full total, not whichever bucket
  // happened to be checked first.
  const depositLineByTrackingCode = new Map();
  for (const l of lines ?? []) {
    if (l.tracking_code) depositLineByTrackingCode.set(l.tracking_code, l);
  }

  const claimedByLineId = {};
  {
    const { data: claimedLines, error: cErr } = await claimedQuery;
    if (cErr) return { data: null, error: cErr };
    for (const cl of claimedLines ?? []) {
      // picked_boxes/weight is the CONFIRMED amount once recorded (a
      // recount/pick can find fewer than originally requested — e.g. a real
      // case this session: requested 64, picked only 58). Claiming the
      // stale requested figure after that overstates what's actually gone
      // from the batch, which could wrongly block a later withdrawal for
      // the difference that was never really taken. Fall back to requested
      // only while still in progress (picked_* not yet recorded).
      const claimedBoxes = Number(cl.picked_boxes ?? cl.requested_boxes) || 0;
      const claimedWeight = Number(cl.picked_weight ?? cl.requested_weight) || 0;

      const matchedLineId = cl.source_customer_deposit_request_line_id
        ?? (cl.tracking_code ? depositLineByTrackingCode.get(cl.tracking_code)?.id : null);
      if (!matchedLineId) continue;

      const bucket = claimedByLineId[matchedLineId] ?? { boxes: 0, weight: 0, by: [] };
      bucket.boxes += claimedBoxes;
      bucket.weight += claimedWeight;
      // Surfaced to the customer when a balance check comes back short —
      // "0 available" reads as a data error unless they can see it's their
      // OWN other pending withdrawal request holding the stock, not a
      // missing deposit.
      bucket.by.push({
        withdrawalNo: cl.tgd_customer_withdrawal_requests?.withdrawal_no ?? null,
        boxes: claimedBoxes,
        weight: claimedWeight,
      });
      claimedByLineId[matchedLineId] = bucket;
    }
  }

  const headerMap = Object.fromEntries(headers.map((h) => [h.id, h]));
  const enriched = (lines ?? []).map((l) => {
    const claimed = claimedByLineId[l.id] ?? { boxes: 0, weight: 0, by: [] };
    const rawBoxes = Number(l.actual_boxes) || 0;
    const rawWeight = Number(l.actual_weight) || 0;
    const availableBoxes = Math.max(0, rawBoxes - claimed.boxes);
    // Once every box is already claimed, any leftover weight is drift
    // between the deposit's own weighing and each claiming withdrawal's
    // (picked_weight comes from an independent scale reading) — not real
    // stock still available. Zero it too instead of showing e.g. "0 boxes
    // but 0.05kg available", the same fix applied to the Movement Ledger's
    // running balance and the withdrawal print document.
    const availableWeight = availableBoxes === 0 ? 0 : Math.max(0, rawWeight - claimed.weight);
    return {
      ...l,
      request: headerMap[l.deposit_request_id] ?? null,
      actual_boxes: availableBoxes,
      actual_weight: availableWeight,
      claimed_by: claimed.by,
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
  requiresR3Document = false,
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
    p_requires_r3_document: Boolean(requiresR3Document),
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
  requiresR3Document = false,
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
    p_requires_r3_document: Boolean(requiresR3Document),
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
    p_pack_entry_mode: toNullableText(line.packEntryMode),
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

// Pulls a submitted deposit request back to DRAFT so the customer can edit
// it — only valid while still awaiting admin review (see the RPC for the
// exact status guard); once accepted into a warehouse receiving document
// there's no going back.
export async function recallCustomerDepositRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_recall_customer_deposit_request', {
    p_request_id: requestId,
    p_comment: toNullableText(comment),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

// Recalls a deposit request whose receipt is ALREADY confirmed, within 24
// hours of confirmation, back to WAREHOUSE_RECEIVING for correction — a
// much bigger undo than recallCustomerDepositRequest above, since
// CONFIRM_RECEIPT already created real stock movements/balances that this
// reverses too. Blocked server-side if any of the deposit's stock has
// already been withdrawn — see tgd_recall_confirmed_deposit_request.
export async function recallConfirmedDepositRequest(requestId, comment = null) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_recall_confirmed_deposit_request', {
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
  customerProductCode = null,
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
    p_customer_product_code: toNullableText(customerProductCode),
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

// Lets staff add a brand-new line to an already-submitted deposit request —
// for when the customer's physical delivery included an item that wasn't
// on their original declared list. Only works while the request is still
// in a receiving-phase status (before receipt is confirmed) — see
// tgd_admin_add_customer_deposit_request_line.
export async function addAdminDepositRequestLine(depositRequestId, {
  customerProductCode,
  productName = null,
  lotNo = null,
  actualBoxes = null,
  actualWeight = null,
  temperatureType = null,
  note = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_admin_add_customer_deposit_request_line', {
    p_deposit_request_id: depositRequestId,
    p_customer_product_code: toNullableText(customerProductCode),
    p_product_name: toNullableText(productName),
    p_lot_no: toNullableText(lotNo),
    p_actual_boxes: toNullableNumber(actualBoxes),
    p_actual_weight: toNullableNumber(actualWeight),
    p_temperature_type: toNullableText(temperatureType),
    p_note: toNullableText(note),
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
