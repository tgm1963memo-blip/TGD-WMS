import { getUnifiedMovementRows } from './unifiedMovementReadService.js';
import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
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

export async function getConfirmedDepositReceiptRows(filters = {}) {
  if (!supabase) return { data: [], error: null };

  let query = supabase
    .from('tgd_customer_deposit_requests')
    .select(`
      id, request_no, customer_id, status, expected_arrival_date, last_action_at,
      tgd_customer_deposit_request_lines(
        id, line_no, product_id, customer_product_code, product_name, lot_no,
        actual_boxes, actual_weight, location_id, temperature_type
      )
    `)
    .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED']);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.dateFrom) query = query.gte('expected_arrival_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('expected_arrival_date', filters.dateTo);

  const { data, error } = await query;
  if (error) return { data: [], error };

  const rows = [];
  for (const req of (data ?? [])) {
    // Use actual confirmation date (last_action_at) so the row sorts chronologically
    // after the deposit was truly received, not by the customer's planned arrival date.
    const receiptDate = req.last_action_at
      ? req.last_action_at.split('T')[0]
      : req.expected_arrival_date ?? null;

    const confirmedLines = (req.tgd_customer_deposit_request_lines ?? [])
      .filter((l) => l.actual_boxes != null && Number(l.actual_boxes) > 0);

    for (const line of confirmedLines) {
      rows.push({
        id: `deposit-${line.id}`,
        ledger_source: 'stock_ledger',
        movement_type: 'RECEIVE_CONFIRM',
        movement_type_raw: 'RECEIVE_CONFIRM',
        movement_type_canonical: 'RECEIVE_CONFIRM',
        movement_date: receiptDate,
        customer_id: req.customer_id,
        product_id: line.product_id ?? null,
        lot_id: null,
        lot_no: line.lot_no ?? null,
        qty: Number(line.actual_boxes),
        quantity: Number(line.actual_boxes),
        weight: Number(line.actual_weight ?? 0),
        uom: 'กล่อง',
        product_name: line.product_name ?? line.customer_product_code ?? null,
        customer_product_code: line.customer_product_code ?? null,
        temperature_type: line.temperature_type ?? null,
        from_warehouse_id: null,
        to_warehouse_id: 'RECEIVE',
        source_document_no: req.request_no,
        remark: req.request_no,
      });
    }
  }

  return { data: rows, error: null };
}

// Returns COMPLETED customer withdrawal lines as outbound movement rows.
// These are not in tgd_stock_movements, so they must be fetched separately.
export async function getConfirmedWithdrawalRows(filters = {}) {
  if (!supabase) return { data: [], error: null };

  let query = supabase
    .from('tgd_customer_withdrawal_requests')
    .select(`
      id, withdrawal_no, customer_id, status, last_action_at,
      tgd_customer_withdrawal_request_lines(
        id, line_no, customer_product_code, product_name, lot_no, product_id,
        requested_boxes, requested_weight,
        picked_boxes, picked_weight, picked_at, picked_by_email
      )
    `)
    .eq('status', 'COMPLETED');

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.dateFrom) query = query.gte('last_action_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('last_action_at', `${filters.dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) return { data: [], error };

  const rows = [];
  for (const req of (data ?? [])) {
    const lines = (req.tgd_customer_withdrawal_request_lines ?? [])
      .filter((l) => (l.picked_boxes ?? l.requested_boxes) != null &&
                     Number(l.picked_boxes ?? l.requested_boxes) > 0);

    for (const line of lines) {
      const boxes = Number(line.picked_boxes ?? line.requested_boxes ?? 0);
      // Use picked_weight if recorded; fall back to requested_weight so reports are never 0
      const weight = Number(line.picked_weight ?? line.requested_weight ?? 0);

      rows.push({
        id: `withdrawal-${line.id}`,
        ledger_source: 'stock_ledger',
        movement_type: 'DISPATCH',
        movement_type_raw: 'CUSTOMER_WITHDRAWAL',
        movement_type_canonical: 'DISPATCH',
        movement_date: line.picked_at ?? req.last_action_at,
        customer_id: req.customer_id,
        product_id: line.product_id ?? null,
        lot_id: null,
        lot_no: line.lot_no ?? null,
        qty: boxes,
        quantity: boxes,
        weight,
        uom: 'กล่อง',
        product_name: line.product_name ?? line.customer_product_code ?? null,
        customer_product_code: line.customer_product_code ?? null,
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
