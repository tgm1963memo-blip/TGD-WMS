import { getUnifiedMovementRows } from './unifiedMovementReadService.js';
import { supabase } from './supabaseClient.js';
import { computeDepositLineBalances } from '../utils/stockBalanceCalc.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

// The stock balance RPC (tgd_get_customer_stock_balance /
// tgd_get_all_customer_stock_balances) judges "received/withdrawn by date X"
// using the document's actual status-transition timestamp from
// tgd_customer_document_timeline_events, falling back to
// last_action_at/expected_arrival_date ONLY when no such event exists at
// all — never a customer-supplied planning date first. This report used to
// classify rows by expected_arrival_date/requested_dispatch_date instead,
// which let a document dated on/before a cutoff but not actually confirmed
// until after it get counted on the wrong side of a past as-of-date/dateTo
// comparison (confirmed real-world gap: +1,176 boxes / +10,868.67 kg on a
// 2026-08-18 comparison against the balance page). This helper reproduces
// the RPC's exact date-resolution priority so both the per-row functions
// below and getAuthoritativeBalanceTotals agree with it.
//
// documents: [{ id, fallbackDate: string|null }]. Chunked the same way
// billingRateEngineService.js's aux-service lookup is (a plain
// `.in('document_id', [...hundreds of ids])` GET can exceed Kong/nginx's
// ~8KB request-line limit and fail with a raw 414 — see that file's fix for
// the same class of bug).
const TIMELINE_EVENT_ID_CHUNK_SIZE = 150;

export async function resolveDocumentConfirmedDates(documents, documentType, toStatus) {
  const result = new Map();
  if (!supabase || !documents || documents.length === 0) return result;

  const ids = documents.map((d) => d.id).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < ids.length; i += TIMELINE_EVENT_ID_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + TIMELINE_EVENT_ID_CHUNK_SIZE));
  }
  // Chunks are independent reads — run them concurrently (capped at a fixed
  // 150-id URL size each, same as before) rather than one-by-one, since a
  // broad date range's document count can require several chunks and
  // sequential round trips were adding real, noticeable latency to this
  // report's load time.
  const chunkResults = await Promise.all(chunks.map((chunk) => supabase
    .from('tgd_customer_document_timeline_events')
    .select('document_id, created_at')
    .eq('document_type', documentType)
    .eq('to_status', toStatus)
    .in('document_id', chunk)));

  const earliestEventDateByDocId = new Map();
  for (const { data, error } of chunkResults) {
    if (error) continue; // best-effort — affected docs fall through to fallbackDate below
    for (const ev of (data ?? [])) {
      const evDate = (ev.created_at ?? '').split('T')[0] || null;
      if (!evDate) continue;
      const existing = earliestEventDateByDocId.get(ev.document_id);
      if (!existing || evDate < existing) earliestEventDateByDocId.set(ev.document_id, evDate);
    }
  }

  for (const doc of documents) {
    result.set(doc.id, earliestEventDateByDocId.get(doc.id) ?? doc.fallbackDate ?? null);
  }
  return result;
}

// The stock balance page's "remaining" figure (tgd_get_customer_stock_balance)
// is an all-time snapshot — total ever received minus total ever withdrawn,
// with no date scoping at all. For the movement ledger report's grand TOTAL
// to agree with it exactly, the total has to be computed the same way: the
// same per-deposit-line exact/tracking-code match plus FIFO lot-pool
// distribution (see stockBalanceCalc.js), not re-derived from date-filtered
// movement rows grouped by lot_no, which is a different (and looser)
// approximation. customerId is optional — omit it for the all-customers
// admin report.
export async function getAuthoritativeBalanceTotals(customerId = null, asOfDate = null) {
  if (!supabase) return { data: { totalBoxes: 0, totalWeight: 0 }, error: null };

  let depositQuery = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, customer_id, last_action_at, expected_arrival_date,
      tgd_customer_deposit_request_lines(
        id, line_no, lot_no, customer_product_code, tracking_code,
        actual_boxes, actual_weight, expected_boxes, expected_weight
      )
    `)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED']);
  if (customerId) depositQuery = depositQuery.eq('customer_id', customerId);

  let withdrawalQuery = supabase
    .from('tgd_customer_withdrawal_requests')
    .select(`
      id, customer_id, last_action_at,
      tgd_customer_withdrawal_request_lines(
        source_customer_deposit_request_line_id, tracking_code, lot_no, source_lot_no,
        customer_product_code, picked_boxes, picked_weight, requested_boxes, requested_weight
      )
    `)
    .eq('status', 'COMPLETED');
  if (customerId) withdrawalQuery = withdrawalQuery.eq('customer_id', customerId);

  const [depositResult, withdrawalResult] = await Promise.all([depositQuery, withdrawalQuery]);
  if (depositResult.error) return { data: null, error: depositResult.error };
  if (withdrawalResult.error) return { data: null, error: withdrawalResult.error };

  // Point-in-time snapshot: exclude any request whose actual confirmed/
  // completed date (per resolveDocumentConfirmedDates — timeline event
  // first, last_action_at/expected_arrival_date fallback) falls after
  // asOfDate, mirroring exactly what the stock balance RPC's as-of-date
  // branch does. When asOfDate is null (the default, used everywhere this
  // function was already called), this is a no-op and behavior is
  // byte-for-byte unchanged from before.
  let qualifyingDepositRequests = depositResult.data ?? [];
  let qualifyingWithdrawalRequests = withdrawalResult.data ?? [];
  if (asOfDate) {
    const depositDocs = qualifyingDepositRequests.map((req) => ({
      id: req.id,
      fallbackDate: req.last_action_at ? req.last_action_at.split('T')[0] : (req.expected_arrival_date ?? null),
    }));
    const withdrawalDocs = qualifyingWithdrawalRequests.map((req) => ({
      id: req.id,
      fallbackDate: req.last_action_at ? req.last_action_at.split('T')[0] : null,
    }));
    const [confirmedDepositDateByReqId, confirmedWithdrawalDateByReqId] = await Promise.all([
      resolveDocumentConfirmedDates(depositDocs, 'CUSTOMER_DEPOSIT_REQUEST', 'RECEIVED_CONFIRMED'),
      resolveDocumentConfirmedDates(withdrawalDocs, 'CUSTOMER_WITHDRAWAL_REQUEST', 'COMPLETED'),
    ]);
    qualifyingDepositRequests = qualifyingDepositRequests.filter((req) => {
      const d = confirmedDepositDateByReqId.get(req.id);
      return d && d <= asOfDate;
    });
    qualifyingWithdrawalRequests = qualifyingWithdrawalRequests.filter((req) => {
      const d = confirmedWithdrawalDateByReqId.get(req.id);
      return d && d <= asOfDate;
    });
  }

  const depositLines = [];
  for (const req of qualifyingDepositRequests) {
    for (const line of (req.tgd_customer_deposit_request_lines ?? [])) {
      depositLines.push({
        id: line.id,
        customer_id: req.customer_id,
        lot_no: line.lot_no ?? '',
        customer_product_code: line.customer_product_code ?? '',
        line_no: line.line_no ?? 0,
        tracking_code: line.tracking_code ?? null,
        received_boxes: Number(line.actual_boxes ?? line.expected_boxes ?? 0),
        received_weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
      });
    }
  }

  const withdrawalLines = [];
  for (const req of qualifyingWithdrawalRequests) {
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      withdrawalLines.push({
        customer_id: req.customer_id,
        source_customer_deposit_request_line_id: line.source_customer_deposit_request_line_id ?? null,
        tracking_code: line.tracking_code ?? null,
        lot_no: line.lot_no ?? '',
        source_lot_no: line.source_lot_no ?? null,
        customer_product_code: line.customer_product_code ?? '',
        // COMPLETED withdrawal lines can have only requested_* recorded (the
        // handheld pick step allows a boxes-only or weight-only entry, and
        // some are completed with neither ever filled in) — the RPC this
        // must agree with falls back to requested_* for exactly this reason
        // (supabase/migrations/20260715090000_stock_balance_coalesce_picked_requested.sql).
        // Summing bare picked_boxes/picked_weight here undercounted what was
        // actually withdrawn, making this total overstate remaining stock
        // relative to the stock balance page.
        picked_boxes: Number(line.picked_boxes ?? line.requested_boxes ?? 0),
        picked_weight: Number(line.picked_weight ?? line.requested_weight ?? 0),
      });
    }
  }

  const balances = computeDepositLineBalances(depositLines, withdrawalLines);

  // Mirrors the RPC's own WHERE clause exactly (both
  // tgd_get_customer_stock_balance and tgd_get_all_customer_stock_balances,
  // supabase/migrations/20260715090000_stock_balance_coalesce_picked_requested.sql):
  // `WHERE GREATEST(0, received_boxes - withdrawn_boxes) > 0` — a deposit
  // line whose box balance has hit exactly 0 is dropped from the RPC
  // entirely, box AND weight both, even if that line's weight balance is
  // still positive (e.g. picked_weight under-recorded for a withdrawal that
  // otherwise fully covered the boxes). Summing every line's weight
  // unconditionally here — while boxes already only ever add 0 for such a
  // line — silently inflated this total's weight above the balance page's,
  // with box counts matching exactly the whole time (that's what made this
  // one hard to spot: only weight was ever wrong).
  let totalBoxes = 0;
  let totalWeight = 0;
  for (const balance of balances.values()) {
    if (balance.boxes <= 0) continue;
    totalBoxes += balance.boxes;
    totalWeight += balance.weight;
  }

  // Total ever received, over the same deposit lines the balance above was
  // computed from. Defining "delivered" as receivedX - totalX (below) rather
  // than as an independent sum of picked_boxes/picked_weight guarantees
  // received - delivered == balance by construction, for any combination of
  // exact/pool-matched withdrawals — including the edge case where a lot's
  // recorded withdrawals exceed what it actually received (the balance
  // floors at 0 for that lot, so the "delivered" side must likewise cap at
  // what was received, not count the data-entry excess as a real delivery).
  let totalReceivedBoxes = 0;
  let totalReceivedWeight = 0;
  for (const dl of depositLines) {
    totalReceivedBoxes += dl.received_boxes;
    totalReceivedWeight += dl.received_weight;
  }

  const totalDeliveredBoxes = totalReceivedBoxes - totalBoxes;
  const totalDeliveredWeight = totalReceivedWeight - totalWeight;

  return {
    data: {
      totalBoxes,
      totalWeight,
      totalReceivedBoxes,
      totalReceivedWeight,
      totalDeliveredBoxes,
      totalDeliveredWeight,
    },
    error: null,
  };
}

// Deposit lines received before a billing period's start date never show up
// as a row in a date-filtered report (their one RECEIVE_CONFIRM event
// happened before the window), yet whatever they still have in storage as
// of the period start is exactly what STORAGE billing needs to charge for
// that period — the same "ยอดยกมา" concept as the movement ledger report's
// opening balance, but here it becomes an actual billable row rather than a
// display-only forwarding figure. Reuses computeDepositLineBalances (the
// same exact/pool-matching algorithm behind the stock balance page) on a
// subset of deposit/withdrawal lines filtered to "happened before asOfDate"
// — that alone computes "the balance as of asOfDate" with no separate math.
export async function getStorageOpeningBalanceRows(customerId, asOfDate) {
  if (!supabase || !customerId || !asOfDate) return { data: [], error: null };

  const depositQuery = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, request_no, customer_id, expected_arrival_date, last_action_at,
      tgd_customer_deposit_request_lines(
        id, line_no, lot_no, customer_product_code, internal_product_code, product_id,
        tracking_code, product_name, temperature_type,
        actual_boxes, actual_weight, expected_boxes, expected_weight
      )
    `)
    .eq('customer_id', customerId)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED']);

  const withdrawalQuery = supabase
    .from('tgd_customer_withdrawal_requests')
    .select(`
      id, customer_id, last_action_at, requested_dispatch_date,
      tgd_customer_withdrawal_request_lines(
        source_customer_deposit_request_line_id, tracking_code, lot_no, source_lot_no,
        customer_product_code, picked_boxes, picked_weight, requested_boxes, requested_weight, picked_at
      )
    `)
    .eq('customer_id', customerId)
    .eq('status', 'COMPLETED');

  const [depositResult, withdrawalResult] = await Promise.all([depositQuery, withdrawalQuery]);
  if (depositResult.error) return { data: [], error: depositResult.error };
  if (withdrawalResult.error) return { data: [], error: withdrawalResult.error };

  const allDepositLines = [];
  const lineMeta = new Map();
  for (const req of (depositResult.data ?? [])) {
    const receiptDate = req.expected_arrival_date ?? (req.last_action_at ? req.last_action_at.split('T')[0] : null);
    for (const line of (req.tgd_customer_deposit_request_lines ?? [])) {
      allDepositLines.push({
        id: line.id,
        customer_id: req.customer_id,
        lot_no: line.lot_no ?? '',
        customer_product_code: line.customer_product_code ?? '',
        line_no: line.line_no ?? 0,
        tracking_code: line.tracking_code ?? null,
        received_boxes: Number(line.actual_boxes ?? line.expected_boxes ?? 0),
        received_weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
        receipt_date: receiptDate,
      });
      lineMeta.set(line.id, {
        request_no: req.request_no,
        product_name: line.product_name ?? line.customer_product_code ?? null,
        temperature_type: line.temperature_type ?? null,
        product_id: line.product_id ?? null,
        internal_product_code: line.internal_product_code ?? null,
      });
    }
  }

  const beforePeriodLines = allDepositLines.filter((dl) => dl.receipt_date && dl.receipt_date < asOfDate);
  if (beforePeriodLines.length === 0) return { data: [], error: null };

  // Same product resolution as getConfirmedDepositReceiptRows — these lines
  // almost never have product_id set directly, so it's matched via sku
  // against the product master, keeping the Product filter usable on
  // opening-balance rows the same way it already works on regular ones.
  const [skuMap, { tempMap: catalogTempMap }] = await Promise.all([
    getProductSkuMap(),
    getCatalogTemperatureMap([customerId]),
  ]);

  const allWithdrawalLines = [];
  for (const req of (withdrawalResult.data ?? [])) {
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      // Same requested_* fallback as getAuthoritativeBalanceTotals above —
      // a COMPLETED line with only requested_* recorded still counts as
      // withdrawn, matching the RPC this must agree with.
      const boxes = Number(line.picked_boxes ?? line.requested_boxes ?? 0);
      const weight = Number(line.picked_weight ?? line.requested_weight ?? 0);
      if (boxes <= 0 && weight <= 0) continue;
      const pickedDate = (line.picked_at ?? req.requested_dispatch_date ?? req.last_action_at ?? '').split('T')[0] || null;
      allWithdrawalLines.push({
        customer_id: req.customer_id,
        source_customer_deposit_request_line_id: line.source_customer_deposit_request_line_id ?? null,
        tracking_code: line.tracking_code ?? null,
        lot_no: line.lot_no ?? '',
        source_lot_no: line.source_lot_no ?? null,
        customer_product_code: line.customer_product_code ?? '',
        picked_boxes: boxes,
        picked_weight: weight,
        picked_date: pickedDate,
      });
    }
  }

  // Only withdrawals that happened strictly before the period start count
  // toward the opening balance — anything picked on/after asOfDate belongs
  // to the period itself, not to what was already "brought forward".
  const priorWithdrawalLines = allWithdrawalLines.filter((wl) => !wl.picked_date || wl.picked_date < asOfDate);

  const balances = computeDepositLineBalances(beforePeriodLines, priorWithdrawalLines);

  const rows = [];
  for (const dl of beforePeriodLines) {
    const balance = balances.get(dl.id) ?? { boxes: 0, weight: 0 };
    // Box-only filter, matching the RPC's WHERE clause exactly (see the
    // comment in getAuthoritativeBalanceTotals above) — a line whose box
    // balance is 0 doesn't count as "brought forward" even if it has a
    // residual positive weight balance.
    if (balance.boxes <= 0) continue;
    const meta = lineMeta.get(dl.id) ?? {};
    rows.push({
      id: `opening-${dl.id}-asof-${asOfDate}`,
      ledger_source: 'stock_ledger',
      movement_type: 'STORAGE_OPENING_BALANCE',
      movement_type_raw: 'STORAGE_OPENING_BALANCE',
      movement_type_canonical: 'STORAGE_OPENING_BALANCE',
      movement_date: asOfDate,
      customer_id: dl.customer_id,
      product_id: meta.product_id ?? skuMap.get(meta.internal_product_code) ?? skuMap.get(dl.customer_product_code) ?? null,
      lot_no: dl.lot_no,
      qty: balance.boxes,
      quantity: balance.boxes,
      weight: balance.weight,
      uom: 'กล่อง',
      product_name: meta.product_name ?? null,
      customer_product_code: dl.customer_product_code,
      temperature_type: meta.temperature_type
        ?? (dl.customer_product_code ? catalogTempMap.get(`${dl.customer_id}::${dl.customer_product_code}`) : null)
        ?? null,
      tracking_code: dl.tracking_code,
      // Grouped by each line's own original deposit request (not a shared
      // literal) — BillingMovementWeightTable.jsx's groupRowsByDocument
      // keys purely on source_document_no, so every opening-balance line
      // sharing one string would collapse 200+ unrelated lots into a
      // single checkbox/document row instead of one row per original
      // deposit request, same as regular deposit rows already do.
      source_document_no: meta.request_no ? `${meta.request_no} (ยอดยกมา)` : `ยอดยกมา-${dl.id}`,
      source_document_type: 'STORAGE_OPENING_BALANCE',
      remark: meta.request_no ? `ยอดคงเหลือยกมาจาก ${meta.request_no}` : 'ยอดคงเหลือยกมาก่อนช่วงบิลลิ่งที่เลือก',
    });
  }

  return { data: rows, error: null };
}

function movementDirection(row) {
  if (row.to_warehouse_id && !row.from_warehouse_id) return 'IN';
  if (row.from_warehouse_id && !row.to_warehouse_id) return 'OUT';
  return 'NEUTRAL';
}

export function summarizeMovements(rows = []) {
  const customerIds = new Set();
  const lotIds = new Set();
  const palletIds = new Set();

  const totals = rows.reduce((summary, row) => {
    if (row.customer_id) customerIds.add(row.customer_id);
    if (row.lot_id) lotIds.add(row.lot_id);
    if (row.from_pallet_id) palletIds.add(row.from_pallet_id);
    if (row.to_pallet_id) palletIds.add(row.to_pallet_id);

    const qty = Number(row.qty ?? 0);
    const direction = movementDirection(row);

    if (direction === 'IN') {
      summary.totalInboundQty += qty;
      summary.netMovementQty += qty;
    }

    if (direction === 'OUT') {
      summary.totalOutboundQty += qty;
      summary.netMovementQty -= qty;
    }

    return summary;
  }, {
    totalMovementRows: rows.length,
    totalInboundQty: 0,
    totalOutboundQty: 0,
    netMovementQty: 0,
  });

  return {
    ...totals,
    uniqueCustomers: customerIds.size,
    uniqueLots: lotIds.size,
    uniquePallets: palletIds.size,
  };
}

export function groupByMovementType(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row.movement_type ?? 'UNSPECIFIED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      movement_type: groupKey,
      movement_count: 0,
      total_qty: 0,
    };

    current.movement_count += 1;
    current.total_qty += Number(row.qty ?? 0);
    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

export async function getMovementLedgerRows(filters = {}) {
  const result = await getUnifiedMovementRows(filters);
  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data ?? [], error: null };
}

export async function getMovementLedgerSummary(filters = {}) {
  const { data, error } = await getMovementLedgerRows(filters);

  if (error) {
    return { data: null, error };
  }

  return { data: summarizeMovements(data ?? []), error: null };
}

export async function getMovementTypeBreakdown(filters = {}) {
  const { data, error } = await getMovementLedgerRows(filters);

  if (error) {
    return { data: null, error };
  }

  return { data: groupByMovementType(data ?? []), error: null };
}

// Deposit and withdrawal request lines almost never carry a product_id — the
// customer portal identifies products by customer_product_code /
// internal_product_code instead. Resolve the master product via those codes
// (matched against tgd_products.sku) so product filtering/grouping works.
async function getProductSkuMap() {
  const map = new Map();
  if (!supabase) return map;

  const { data, error } = await supabase.from('tgd_products').select('id, sku');
  if (error || !data) return map;

  for (const p of data) {
    if (p.sku) map.set(p.sku, p.id);
  }
  return map;
}

function resolveLineProductId(line, skuMap) {
  if (line.product_id) return line.product_id;
  return skuMap.get(line.internal_product_code) ?? skuMap.get(line.customer_product_code) ?? null;
}

// Fallback temperature_type/product_category source when a deposit/
// withdrawal line doesn't carry its own: the customer's master item
// catalog (tgd_customer_products). Both maps are keyed by
// "customerId::customer_product_code" since customer_product_code is only
// unique within a single customer, not globally. One query serves both —
// product_category has no per-line snapshot at all (it's catalog-only), so
// this is its only source for a movement row.
async function getCatalogTemperatureMap(customerIds) {
  const tempMap = new Map();
  const categoryMap = new Map();
  if (!supabase || !customerIds || customerIds.length === 0) return { tempMap, categoryMap };

  const { data, error } = await supabase
    .from('tgd_customer_products')
    .select('customer_id, customer_product_code, temperature_type, product_category')
    .in('customer_id', customerIds);

  if (error || !data) return { tempMap, categoryMap };

  for (const row of data) {
    if (!row.customer_product_code) continue;
    const key = `${row.customer_id}::${row.customer_product_code}`;
    if (row.temperature_type) tempMap.set(key, row.temperature_type);
    if (row.product_category) categoryMap.set(key, row.product_category);
  }
  return { tempMap, categoryMap };
}

export async function getConfirmedDepositReceiptRows(filters = {}) {
  if (!supabase) return { data: [], error: null };

  const hasLineFilter = filters.trackingCode || filters.lotNo || filters.productCode;
  const lineRelation = hasLineFilter ? 'tgd_customer_deposit_request_lines!inner' : 'tgd_customer_deposit_request_lines';
  let query = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, request_no, customer_id, status, expected_arrival_date, last_action_at,
      ${lineRelation}(
        id, line_no, product_id, customer_product_code, internal_product_code, product_name, lot_no,
        actual_boxes, actual_weight, expected_boxes, expected_weight, location_id, temperature_type, tracking_code
      )
    `)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED']);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  // Note: productId filtering happens in JS below (after resolving product_id
  // via sku match) because these lines essentially never have product_id set.
  // productCode filters here instead, directly against the line's own text
  // field, since that's always present even when no sku match exists.
  if (filters.trackingCode) {
    query = query.ilike('tgd_customer_deposit_request_lines.tracking_code', `%${filters.trackingCode.trim()}%`);
  }
  if (filters.lotNo) {
    query = query.ilike('tgd_customer_deposit_request_lines.lot_no', `%${filters.lotNo.trim()}%`);
  }
  if (filters.productCode) {
    query = query.ilike('tgd_customer_deposit_request_lines.customer_product_code', `%${filters.productCode.trim()}%`);
  }
  // Not filtered by date here — the row's actual reporting date is
  // last_action_at (falling back to expected_arrival_date) below, which can
  // differ from expected_arrival_date by days when a customer's scheduled
  // arrival date doesn't match when staff actually confirmed receipt.
  // Filtering the query on expected_arrival_date while classifying rows by
  // last_action_at let some receipts fall on the wrong side of the
  // opening-balance cutoff (or drop out of the report entirely), which is
  // exactly what made SUB TOTAL/TOTAL undercount ยอดยกมา. Date range is
  // applied in JS below, against the same date used for movement_date.

  const { data, error } = await query;
  if (error) return { data: [], error };

  const customerIds = [...new Set((data ?? []).map((req) => req.customer_id).filter(Boolean))];
  const [skuMap, { tempMap: catalogTempMap, categoryMap: catalogCategoryMap }, confirmedDateByReqId] = await Promise.all([
    getProductSkuMap(),
    getCatalogTemperatureMap(customerIds),
    resolveDocumentConfirmedDates(
      (data ?? []).map((req) => ({
        id: req.id,
        fallbackDate: req.last_action_at ? req.last_action_at.split('T')[0] : (req.expected_arrival_date ?? null),
      })),
      'CUSTOMER_DEPOSIT_REQUEST',
      'RECEIVED_CONFIRMED',
    ),
  ]);

  const rows = [];
  for (const req of (data ?? [])) {
    // The document's actual RECEIVED_CONFIRMED transition date (from
    // tgd_customer_document_timeline_events), falling back to
    // last_action_at/expected_arrival_date only when no such event exists —
    // matching the stock balance RPC's as-of-date logic exactly, NOT the
    // customer's planning date (expected_arrival_date), which can predate
    // the actual confirmation by days and previously let this report
    // wrongly include a receipt as "by date X" before it truly happened.
    const receiptDate = confirmedDateByReqId.get(req.id) ?? null;

    if (filters.dateFrom && receiptDate && receiptDate < filters.dateFrom) continue;
    if (filters.dateTo && receiptDate && receiptDate > filters.dateTo) continue;

    // Same actual-then-expected fallback as getAuthoritativeBalanceTotals —
    // a confirmed line with no actual_* recorded yet still has a received
    // quantity via expected_*, and excluding it here (while the
    // authoritative total counts it) understated this report's per-row/
    // SUB TOTAL received figures relative to the grand TOTAL row.
    const confirmedLines = (req.tgd_customer_deposit_request_lines ?? [])
      .filter((l) => Number(l.actual_boxes ?? l.expected_boxes ?? 0) > 0 || Number(l.actual_weight ?? l.expected_weight ?? 0) > 0);

    for (const line of confirmedLines) {
      const resolvedProductId = resolveLineProductId(line, skuMap);

      if (filters.productId) {
        const pFilter = Array.isArray(filters.productId) ? filters.productId : [filters.productId];
        if (pFilter.length > 0 && !pFilter.includes(resolvedProductId)) {
          continue;
        }
      }

      rows.push({
        id: `deposit-${line.id}`,
        ledger_source: 'stock_ledger',
        movement_type: 'RECEIVE_CONFIRM',
        movement_type_raw: 'RECEIVE_CONFIRM',
        movement_type_canonical: 'RECEIVE_CONFIRM',
        movement_date: receiptDate,
        customer_id: req.customer_id,
        product_id: resolvedProductId,
        lot_id: null,
        lot_no: line.lot_no ?? null,
        qty: Number(line.actual_boxes ?? line.expected_boxes ?? 0),
        quantity: Number(line.actual_boxes ?? line.expected_boxes ?? 0),
        weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
        uom: 'กล่อง',
        product_name: line.product_name ?? line.customer_product_code ?? null,
        customer_product_code: line.customer_product_code ?? null,
        temperature_type: line.temperature_type
          ?? (line.customer_product_code ? catalogTempMap.get(`${req.customer_id}::${line.customer_product_code}`) : null)
          ?? null,
        product_category: line.customer_product_code
          ? (catalogCategoryMap.get(`${req.customer_id}::${line.customer_product_code}`) ?? null)
          : null,
        location_id: line.location_id ?? null,
        tracking_code: line.tracking_code ?? null,
        from_warehouse_id: null,
        to_warehouse_id: 'RECEIVE',
        source_document_no: req.request_no,
        remark: req.request_no,
      });
    }
  }

  return { data: rows, error: null };
}

// Withdrawal lines carry no temperature_type of their own — customers never
// pick a temperature when requesting a withdrawal. Look it up from the
// confirmed deposit line(s) the withdrawal was picked from, mirroring the
// same A/B match used by tgd_get_customer_stock_balance (migration
// 20260625000010): prefer the direct source_customer_deposit_request_id link
// (tie-broken by lot_no), and fall back to a lot_no + customer_product_code
// match when the line has no direct link.
async function getInboundTemperatureIndex(customerIds) {
  const index = new Map();
  if (!supabase || customerIds.length === 0) return index;

  const { data, error } = await supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, customer_id, status,
      tgd_customer_deposit_request_lines(
        id, deposit_request_id, lot_no, customer_product_code, product_id, temperature_type, location_id
      )
    `)
    .in('customer_id', customerIds)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED']);

  if (error || !data) return index;

  for (const req of data) {
    for (const line of (req.tgd_customer_deposit_request_lines ?? [])) {
      const bucket = index.get(req.customer_id) ?? [];
      bucket.push({ ...line, deposit_request_id: line.deposit_request_id ?? req.id });
      index.set(req.customer_id, bucket);
    }
  }

  return index;
}

function resolveWithdrawalTemperature(line, customerId, inboundIndex) {
  const candidates = inboundIndex.get(customerId) ?? [];
  if (candidates.length === 0) return null;

  // A: direct link via source deposit request, tie-broken by lot_no
  if (line.source_customer_deposit_request_id) {
    const lotHint = line.source_lot_no ?? line.lot_no ?? null;
    const direct = candidates.find((dl) =>
      dl.deposit_request_id === line.source_customer_deposit_request_id &&
      (lotHint == null || dl.lot_no === lotHint));
    if (direct) return direct.temperature_type;
  }

  // B: no direct link — match by lot_no; product code is optional (blank = any)
  const lotNo = line.lot_no ?? '';
  const code = (line.customer_product_code ?? '').trim();
  const byLot = candidates.find((dl) =>
    (dl.lot_no ?? '') === lotNo &&
    (code === '' || dl.customer_product_code === line.customer_product_code));
  if (byLot) return byLot.temperature_type;

  // C: last resort — same product code regardless of lot (covers lots recorded
  // inconsistently between the deposit and withdrawal side).
  if (code !== '') {
    const byCode = candidates.find((dl) => dl.customer_product_code === line.customer_product_code);
    if (byCode) return byCode.temperature_type;
  }

  return null;
}

// Withdrawal lines have no location_id column of their own (unlike deposit
// lines) — a picked box leaves whatever location it was stored at, and the
// line itself never recorded which one. Resolved from the source deposit
// line instead, via the same A/B/C match as resolveWithdrawalTemperature.
function resolveWithdrawalLocation(line, customerId, inboundIndex) {
  const candidates = inboundIndex.get(customerId) ?? [];
  if (candidates.length === 0) return null;

  if (line.source_customer_deposit_request_id) {
    const lotHint = line.source_lot_no ?? line.lot_no ?? null;
    const direct = candidates.find((dl) =>
      dl.deposit_request_id === line.source_customer_deposit_request_id &&
      (lotHint == null || dl.lot_no === lotHint));
    if (direct) return direct.location_id;
  }

  const lotNo = line.lot_no ?? '';
  const code = (line.customer_product_code ?? '').trim();
  const byLot = candidates.find((dl) =>
    (dl.lot_no ?? '') === lotNo &&
    (code === '' || dl.customer_product_code === line.customer_product_code));
  if (byLot) return byLot.location_id;

  if (code !== '') {
    const byCode = candidates.find((dl) => dl.customer_product_code === line.customer_product_code);
    if (byCode) return byCode.location_id;
  }

  return null;
}

function resolveWithdrawalProductId(line, customerId, inboundIndex, skuMap) {
  if (line.product_id) return line.product_id;

  // Withdrawal lines almost never have product_id set — match the sku
  // recorded on the line (internal or customer code) against the product
  // master first, since that's reliable even when there's no confirmed
  // deposit line to cross-reference (deposit lines don't have product_id
  // either, so the candidate-matching fallback below rarely succeeds).
  const bySku = skuMap.get(line.internal_product_code) ?? skuMap.get(line.customer_product_code);
  if (bySku) return bySku;

  const candidates = inboundIndex.get(customerId) ?? [];
  if (candidates.length === 0) return null;

  if (line.source_customer_deposit_request_id) {
    const lotHint = line.source_lot_no ?? line.lot_no ?? null;
    const direct = candidates.find((dl) =>
      dl.deposit_request_id === line.source_customer_deposit_request_id &&
      (lotHint == null || dl.lot_no === lotHint));
    if (direct && direct.product_id) return direct.product_id;
  }

  // B: no direct link — match by lot_no; product code is optional (blank = any)
  const lotNo = line.lot_no ?? '';
  const code = (line.customer_product_code ?? '').trim();
  const byLot = candidates.find((dl) =>
    (dl.lot_no ?? '') === lotNo &&
    (code === '' || dl.customer_product_code === line.customer_product_code));
  if (byLot && byLot.product_id) return byLot.product_id;

  // C: last resort — same product code regardless of lot
  if (code !== '') {
    const byCode = candidates.find((dl) => dl.customer_product_code === line.customer_product_code);
    if (byCode && byCode.product_id) return byCode.product_id;
  }

  return null;
}

// Returns COMPLETED customer withdrawal lines as outbound movement rows.
// These are not in tgd_stock_movements, so they must be fetched separately.
export async function getConfirmedWithdrawalRows(filters = {}) {
  if (!supabase) return { data: [], error: null };

  const hasLineFilter = filters.trackingCode || filters.lotNo || filters.productCode;
  const lineRelation = hasLineFilter ? 'tgd_customer_withdrawal_request_lines!inner' : 'tgd_customer_withdrawal_request_lines';
  let query = supabase
    .from('tgd_customer_withdrawal_requests')
    .select(`
      id, withdrawal_no, customer_id, status, last_action_at, requested_dispatch_date,
      ${lineRelation}(
        id, line_no, customer_product_code, internal_product_code, product_name, lot_no, product_id,
        source_customer_deposit_request_id, source_lot_no,
        requested_boxes, requested_weight,
        picked_boxes, picked_weight, picked_at, picked_by_email, tracking_code
      )
    `)
    .eq('status', 'COMPLETED');

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  // Note: We filter productId in JS below because some legacy withdrawal lines might have null product_id
  // and need to be resolved via the inbound index first. productCode filters here instead,
  // directly against the line's own text field, since that's always present even when no
  // sku match exists (e.g. a product never registered in the internal product master).
  if (filters.trackingCode) {
    query = query.ilike('tgd_customer_withdrawal_request_lines.tracking_code', `%${filters.trackingCode.trim()}%`);
  }
  if (filters.lotNo) {
    query = query.ilike('tgd_customer_withdrawal_request_lines.lot_no', `%${filters.lotNo.trim()}%`);
  }
  if (filters.productCode) {
    query = query.ilike('tgd_customer_withdrawal_request_lines.customer_product_code', `%${filters.productCode.trim()}%`);
  }
  // Not filtered by date here — a line's actual reporting date is
  // picked_at (falling back to the request's last_action_at) below, which
  // can differ from the request-level last_action_at when lines within
  // the same withdrawal were picked on different days. Filtering the query
  // on last_action_at while classifying lines by picked_at let some picks
  // fall on the wrong side of the opening-balance cutoff. Date range is
  // applied in JS below, against the same date used for movement_date.

  const { data, error } = await query;
  if (error) return { data: [], error };

  const customerIds = [...new Set((data ?? []).map((req) => req.customer_id).filter(Boolean))];
  const [inboundIndex, skuMap, { tempMap: catalogTempMap, categoryMap: catalogCategoryMap }, confirmedDateByReqId] = await Promise.all([
    getInboundTemperatureIndex(customerIds),
    getProductSkuMap(),
    getCatalogTemperatureMap(customerIds),
    resolveDocumentConfirmedDates(
      (data ?? []).map((req) => ({
        id: req.id,
        fallbackDate: req.last_action_at ? req.last_action_at.split('T')[0] : null,
      })),
      'CUSTOMER_WITHDRAWAL_REQUEST',
      'COMPLETED',
    ),
  ]);

  const rows = [];
  for (const req of (data ?? [])) {
    // The document's actual COMPLETED transition date (from
    // tgd_customer_document_timeline_events), falling back to
    // last_action_at only when no such event exists — matching the stock
    // balance RPC's as-of-date logic exactly (which falls back to
    // wr.last_action_at at the request level, not a per-line picked_at, and
    // never to requested_dispatch_date, a customer planning date that can
    // predate actual completion by days).
    const movementDate = confirmedDateByReqId.get(req.id) ?? null;
    if (filters.dateFrom && movementDate && movementDate < filters.dateFrom) continue;
    if (filters.dateTo && movementDate && movementDate > filters.dateTo) continue;

    // A COMPLETED withdrawal line can have only requested_boxes/
    // requested_weight recorded (the handheld pick step allows a boxes-only
    // or weight-only entry, and some lines are completed with neither
    // picked_* ever filled in) — the stock balance RPC this report must
    // agree with falls back to requested_* for exactly this reason
    // (supabase/migrations/20260715090000_stock_balance_coalesce_picked_requested.sql).
    // Requiring bare picked_boxes/picked_weight here dropped such lines
    // entirely, understating what actually left the warehouse and making
    // this report's remaining stock disagree with the balance page.
    const lines = (req.tgd_customer_withdrawal_request_lines ?? [])
      .filter((l) => Number(l.picked_boxes ?? l.requested_boxes ?? 0) > 0 || Number(l.picked_weight ?? l.requested_weight ?? 0) > 0);

    for (const line of lines) {
      const boxes = Number(line.picked_boxes ?? line.requested_boxes ?? 0);
      const weight = Number(line.picked_weight ?? line.requested_weight ?? 0);

      const resolvedProductId = resolveWithdrawalProductId(line, req.customer_id, inboundIndex, skuMap);

      if (filters.productId) {
        const pFilter = Array.isArray(filters.productId) ? filters.productId : [filters.productId];
        if (pFilter.length > 0 && !pFilter.includes(resolvedProductId)) {
          continue;
        }
      }

      rows.push({
        id: `withdrawal-${line.id}`,
        ledger_source: 'stock_ledger',
        movement_type: 'DISPATCH',
        movement_type_raw: 'CUSTOMER_WITHDRAWAL',
        movement_type_canonical: 'DISPATCH',
        movement_date: movementDate,
        customer_id: req.customer_id,
        product_id: resolvedProductId,
        lot_id: null,
        lot_no: line.lot_no ?? null,
        qty: boxes,
        quantity: boxes,
        weight,
        uom: 'กล่อง',
        product_name: line.product_name ?? line.customer_product_code ?? null,
        customer_product_code: line.customer_product_code ?? null,
        temperature_type: resolveWithdrawalTemperature(line, req.customer_id, inboundIndex)
          ?? (line.customer_product_code ? catalogTempMap.get(`${req.customer_id}::${line.customer_product_code}`) : null)
          ?? null,
        product_category: line.customer_product_code
          ? (catalogCategoryMap.get(`${req.customer_id}::${line.customer_product_code}`) ?? null)
          : null,
        location_id: resolveWithdrawalLocation(line, req.customer_id, inboundIndex) ?? null,
        tracking_code: line.tracking_code ?? null,
        from_warehouse_id: 'DISPATCH',
        to_warehouse_id: null,
        source_document_no: req.withdrawal_no,
        remark: req.withdrawal_no,
      });
    }
  }

  return { data: rows, error: null };
}

export async function getMovementByReference(filters = {}) {
  const result = await getUnifiedMovementRows(filters);
  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data ?? [], error: null };
}
