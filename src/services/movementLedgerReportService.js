import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyMovementFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.dateFrom) {
    nextQuery = nextQuery.gte('created_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    nextQuery = nextQuery.lte('created_at', filters.dateTo);
  }

  if (filters.movementType) {
    nextQuery = nextQuery.eq('movement_type', filters.movementType);
  }

  if (filters.productId) {
    nextQuery = nextQuery.eq('product_id', filters.productId);
  }

  if (filters.customerId) {
    nextQuery = nextQuery.eq('customer_id', filters.customerId);
  }

  if (filters.locationId) {
    nextQuery = nextQuery.or(`from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId}`);
  }

  if (filters.warehouseId) {
    nextQuery = nextQuery.or(`from_warehouse_id.eq.${filters.warehouseId},to_warehouse_id.eq.${filters.warehouseId}`);
  }

  if (filters.referenceType) {
    nextQuery = nextQuery.eq('reference_type', filters.referenceType);
  }

  return nextQuery;
}

function movementDirection(row) {
  if (row.to_warehouse_id && !row.from_warehouse_id) return 'IN';
  if (row.from_warehouse_id && !row.to_warehouse_id) return 'OUT';
  return 'NEUTRAL';
}

function summarizeMovements(rows = []) {
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

function groupByMovementType(rows = []) {
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
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const query = applyMovementFilters(
    supabase
      .from('tgd_inventory_movements')
      .select('id, movement_no, movement_type, movement_subtype, customer_id, product_id, lot_id, from_warehouse_id, from_location_id, from_pallet_id, to_warehouse_id, to_location_id, to_pallet_id, qty, uom, reference_type, reference_no, reference_id, reason_code, remark, created_by, created_at, is_reversed, reversed_by_movement_id')
      .order('created_at', { ascending: false }),
    filters,
  );

  return query;
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

export async function getMovementByReference(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_inventory_movements')
    .select('id, movement_no, movement_type, customer_id, product_id, lot_id, qty, uom, reference_type, reference_no, reference_id, created_by, created_at')
    .order('created_at', { ascending: false });

  if (filters.referenceType) {
    query = query.eq('reference_type', filters.referenceType);
  }

  if (filters.referenceNo) {
    query = query.eq('reference_no', filters.referenceNo);
  }

  if (filters.referenceId) {
    query = query.eq('reference_id', filters.referenceId);
  }

  return query;
}
