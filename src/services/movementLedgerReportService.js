import { getUnifiedMovementRows } from './unifiedMovementReadService.js';
import { supabase } from './supabaseClient.js';
import { computeDepositLineBalances } from '../utils/stockBalanceCalc.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
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
export async function getAuthoritativeBalanceTotals(customerId = null) {
  if (!supabase) return { data: { totalBoxes: 0, totalWeight: 0 }, error: null };

  let depositQuery = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      customer_id,
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
      customer_id,
      tgd_customer_withdrawal_request_lines(
        source_customer_deposit_request_line_id, tracking_code, lot_no, source_lot_no,
        customer_product_code, picked_boxes, picked_weight
      )
    `)
    .eq('status', 'COMPLETED');
  if (customerId) withdrawalQuery = withdrawalQuery.eq('customer_id', customerId);

  const [depositResult, withdrawalResult] = await Promise.all([depositQuery, withdrawalQuery]);
  if (depositResult.error) return { data: null, error: depositResult.error };
  if (withdrawalResult.error) return { data: null, error: withdrawalResult.error };

  const depositLines = [];
  for (const req of (depositResult.data ?? [])) {
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
  for (const req of (withdrawalResult.data ?? [])) {
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      withdrawalLines.push({
        customer_id: req.customer_id,
        source_customer_deposit_request_line_id: line.source_customer_deposit_request_line_id ?? null,
        tracking_code: line.tracking_code ?? null,
        lot_no: line.lot_no ?? '',
        source_lot_no: line.source_lot_no ?? null,
        customer_product_code: line.customer_product_code ?? '',
        picked_boxes: Number(line.picked_boxes ?? 0),
        picked_weight: Number(line.picked_weight ?? 0),
      });
    }
  }

  const balances = computeDepositLineBalances(depositLines, withdrawalLines);

  let totalBoxes = 0;
  let totalWeight = 0;
  for (const balance of balances.values()) {
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

export async function getConfirmedDepositReceiptRows(filters = {}) {
  if (!supabase) return { data: [], error: null };

  const hasLineFilter = filters.trackingCode || filters.lotNo;
  const lineRelation = hasLineFilter ? 'tgd_customer_deposit_request_lines!inner' : 'tgd_customer_deposit_request_lines';
  let query = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, request_no, customer_id, status, expected_arrival_date, last_action_at,
      ${lineRelation}(
        id, line_no, product_id, customer_product_code, internal_product_code, product_name, lot_no,
        actual_boxes, actual_weight, location_id, temperature_type, tracking_code
      )
    `)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED']);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  // Note: product filtering happens in JS below (after resolving product_id
  // via sku match) because these lines essentially never have product_id set.
  if (filters.trackingCode) {
    query = query.ilike('tgd_customer_deposit_request_lines.tracking_code', `%${filters.trackingCode.trim()}%`);
  }
  if (filters.lotNo) {
    query = query.ilike('tgd_customer_deposit_request_lines.lot_no', `%${filters.lotNo.trim()}%`);
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

  const skuMap = await getProductSkuMap();

  const rows = [];
  for (const req of (data ?? [])) {
    // Use expected_arrival_date (the document date) as the movement date,
    // falling back to last_action_at if not available.
    const receiptDate = req.expected_arrival_date ?? (req.last_action_at ? req.last_action_at.split('T')[0] : null);

    if (filters.dateFrom && receiptDate && receiptDate < filters.dateFrom) continue;
    if (filters.dateTo && receiptDate && receiptDate > filters.dateTo) continue;

    const confirmedLines = (req.tgd_customer_deposit_request_lines ?? [])
      .filter((l) => (l.actual_boxes != null && Number(l.actual_boxes) > 0) || (l.actual_weight != null && Number(l.actual_weight) > 0));

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
        qty: Number(line.actual_boxes ?? 0),
        quantity: Number(line.actual_boxes ?? 0),
        weight: Number(line.actual_weight ?? 0),
        uom: 'กล่อง',
        product_name: line.product_name ?? line.customer_product_code ?? null,
        customer_product_code: line.customer_product_code ?? null,
        temperature_type: line.temperature_type ?? null,
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
        id, deposit_request_id, lot_no, customer_product_code, product_id, temperature_type
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

  const hasLineFilter = filters.trackingCode || filters.lotNo;
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
  // and need to be resolved via the inbound index first.
  if (filters.trackingCode) {
    query = query.ilike('tgd_customer_withdrawal_request_lines.tracking_code', `%${filters.trackingCode.trim()}%`);
  }
  if (filters.lotNo) {
    query = query.ilike('tgd_customer_withdrawal_request_lines.lot_no', `%${filters.lotNo.trim()}%`);
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
  const [inboundIndex, skuMap] = await Promise.all([
    getInboundTemperatureIndex(customerIds),
    getProductSkuMap(),
  ]);

  const rows = [];
  for (const req of (data ?? [])) {
    // Only actually-picked lines count as a real outbound movement — a
    // COMPLETED withdrawal can still have a line whose picked_boxes/
    // picked_weight were never recorded (nothing was ever actually pulled
    // and weighed for it). Falling back to requested_boxes/requested_weight
    // here counted goods as shipped that were never actually confirmed
    // picked, which is exactly what made this report's remaining weight
    // disagree with the stock balance page (that RPC only ever sums
    // picked_weight, never requested_weight).
    const lines = (req.tgd_customer_withdrawal_request_lines ?? [])
      .filter((l) => Number(l.picked_boxes ?? 0) > 0 || Number(l.picked_weight ?? 0) > 0);

    for (const line of lines) {
      const movementDate = req.requested_dispatch_date ?? ((line.picked_at ?? req.last_action_at ?? '').split('T')[0] || null);
      if (filters.dateFrom && movementDate && movementDate < filters.dateFrom) continue;
      if (filters.dateTo && movementDate && movementDate > filters.dateTo) continue;

      const boxes = Number(line.picked_boxes ?? 0);
      const weight = Number(line.picked_weight ?? 0);

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
        movement_date: req.requested_dispatch_date ?? line.picked_at ?? req.last_action_at,
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
        temperature_type: resolveWithdrawalTemperature(line, req.customer_id, inboundIndex),
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
