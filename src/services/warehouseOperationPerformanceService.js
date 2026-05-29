import { getOperationChargeLogs } from './operationChargeLogService.js';
import { supabase } from './supabaseClient.js';

const operationSources = [
  {
    type: 'RECEIVING',
    table: 'tgd_receiving_documents',
    documentNo: 'receiving_no',
    dateField: 'received_date',
  },
  {
    type: 'PUTAWAY',
    table: 'tgd_putaway_documents',
    documentNo: 'putaway_no',
    dateField: 'created_at',
  },
  {
    type: 'TRANSFER',
    table: 'tgd_transfer_documents',
    documentNo: 'transfer_no',
    dateField: 'created_at',
  },
  {
    type: 'ADJUSTMENT',
    table: 'tgd_adjustment_documents',
    documentNo: 'adjustment_no',
    dateField: 'created_at',
  },
  {
    type: 'WITHDRAWAL_REQUEST',
    table: 'tgd_withdrawal_requests',
    documentNo: 'withdrawal_no',
    dateField: 'requested_dispatch_date',
  },
  {
    type: 'ALLOCATION',
    table: 'tgd_withdrawal_allocations',
    documentNo: 'allocation_no',
    dateField: 'created_at',
  },
  {
    type: 'PICKING',
    table: 'tgd_picking_documents',
    documentNo: 'picking_no',
    dateField: 'created_at',
  },
  {
    type: 'DISPATCH',
    table: 'tgd_dispatch_documents',
    documentNo: 'dispatch_no',
    dateField: 'dispatch_date',
  },
];

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function applyDocumentFilters(query, filters = {}, source) {
  let nextQuery = query;

  if (filters.dateFrom) nextQuery = nextQuery.gte(source.dateField, filters.dateFrom);
  if (filters.dateTo) nextQuery = nextQuery.lte(source.dateField, filters.dateTo);
  if (filters.customerId) nextQuery = nextQuery.eq('customer_id', filters.customerId);
  if (filters.warehouseId) nextQuery = nextQuery.eq('warehouse_id', filters.warehouseId);
  if (filters.status) nextQuery = nextQuery.eq('status', filters.status);

  return nextQuery;
}

function documentValue(row, key) {
  return row[key] ?? null;
}

function normalizeDocumentRows(rows = [], source) {
  return rows.map((row) => ({
    id: `${source.type}-${row.id}`,
    source_id: row.id,
    operation_date: documentValue(row, source.dateField) ?? row.created_at,
    operation_type: source.type,
    document_no: documentValue(row, source.documentNo),
    customer_id: row.customer_id,
    warehouse_id: row.warehouse_id,
    status: row.status,
    qty: row.total_qty ?? row.qty ?? null,
    weight: row.total_weight ?? row.weight ?? null,
    charge_type: null,
    reference: row.reference_no ?? row.reference_type ?? null,
    created_at: row.created_at,
    created_by: row.created_by,
    billing_relevance_note: 'Operation workload preview',
  }));
}

function matchesOperationFilters(row, filters = {}) {
  if (filters.operationType && row.operation_type !== filters.operationType) return false;
  if (filters.chargeType && row.charge_type !== filters.chargeType) return false;

  if (filters.search) {
    const searchText = String(filters.search).toLowerCase();
    const searchable = [
      row.operation_type,
      row.document_no,
      row.customer_id,
      row.warehouse_id,
      row.status,
      row.reference,
    ].join(' ').toLowerCase();

    return searchable.includes(searchText);
  }

  return true;
}

function summarizeOperations(rows = []) {
  return rows.reduce((summary, row) => {
    summary.total_operations += 1;
    summary.operation_charge_activity_count += row.charge_type ? 1 : 0;

    if (row.operation_type === 'RECEIVING') summary.receiving_count += 1;
    if (row.operation_type === 'PUTAWAY') summary.putaway_count += 1;
    if (row.operation_type === 'TRANSFER') summary.transfer_count += 1;
    if (row.operation_type === 'ADJUSTMENT') summary.adjustment_count += 1;
    if (row.operation_type === 'WITHDRAWAL_REQUEST') summary.withdrawal_request_count += 1;
    if (row.operation_type === 'PICKING') summary.picking_count += 1;
    if (row.operation_type === 'DISPATCH') summary.dispatch_count += 1;

    const normalizedStatus = String(row.status ?? '').toUpperCase();
    if (['OPEN', 'DRAFT', 'PENDING', 'IN_PROGRESS'].includes(normalizedStatus)) summary.pending_operations += 1;
    if (['COMPLETED', 'POSTED', 'CONFIRMED', 'DISPATCHED'].includes(normalizedStatus)) summary.completed_operations += 1;

    return summary;
  }, {
    total_operations: 0,
    receiving_count: 0,
    putaway_count: 0,
    transfer_count: 0,
    adjustment_count: 0,
    withdrawal_request_count: 0,
    picking_count: 0,
    dispatch_count: 0,
    pending_operations: 0,
    completed_operations: 0,
    operation_charge_activity_count: 0,
  });
}

function groupOperationRows(rows = [], key) {
  const groups = new Map();

  rows.forEach((row) => {
    const groupKey = row[key] ?? 'UNASSIGNED';
    const current = groups.get(groupKey) ?? {
      id: groupKey,
      group_id: groupKey,
      operation_count: 0,
      pending_count: 0,
      completed_count: 0,
      charge_activity_count: 0,
    };

    current.operation_count += 1;
    if (row.charge_type) current.charge_activity_count += 1;

    const normalizedStatus = String(row.status ?? '').toUpperCase();
    if (['OPEN', 'DRAFT', 'PENDING', 'IN_PROGRESS'].includes(normalizedStatus)) current.pending_count += 1;
    if (['COMPLETED', 'POSTED', 'CONFIRMED', 'DISPATCHED'].includes(normalizedStatus)) current.completed_count += 1;

    groups.set(groupKey, current);
  });

  return Array.from(groups.values());
}

function groupByStatus(rows = []) {
  return groupOperationRows(rows, 'status');
}

async function fetchSourceRows(source, filters = {}) {
  const query = applyDocumentFilters(
    supabase
      .from(source.table)
      .select('id, customer_id, warehouse_id, status, reference_no, reference_type, total_qty, total_weight, qty, weight, created_at, created_by, receiving_no, putaway_no, transfer_no, adjustment_no, withdrawal_no, allocation_no, picking_no, dispatch_no, received_date, requested_dispatch_date, dispatch_date')
      .order(source.dateField, { ascending: false }),
    filters,
    source,
  );

  return query;
}

export async function getOperationPerformanceRows(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const sources = filters.operationType
    ? operationSources.filter((source) => source.type === filters.operationType)
    : operationSources;

  const results = await Promise.all(sources.map((source) => fetchSourceRows(source, filters)));
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) return { data: null, error: firstError };

  const rows = results.flatMap((result, index) => normalizeDocumentRows(result.data ?? [], sources[index]));

  return {
    data: rows.filter((row) => matchesOperationFilters(row, filters)),
    error: null,
  };
}

export async function getOperationPerformanceSummary(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  return { data: summarizeOperations(data ?? []), error: null };
}

export async function getOperationVolumeByCustomer(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  return { data: groupOperationRows(data ?? [], 'customer_id'), error: null };
}

export async function getOperationVolumeByWarehouse(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  return { data: groupOperationRows(data ?? [], 'warehouse_id'), error: null };
}

export async function getOperationVolumeByType(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  return { data: groupOperationRows(data ?? [], 'operation_type'), error: null };
}

export async function getOperationStatusBreakdown(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  return { data: groupByStatus(data ?? []), error: null };
}

export async function getPendingOperationSummary(filters = {}) {
  const { data, error } = await getOperationPerformanceRows(filters);
  if (error) return { data: null, error };

  const pendingRows = (data ?? []).filter((row) => ['OPEN', 'DRAFT', 'PENDING', 'IN_PROGRESS'].includes(String(row.status ?? '').toUpperCase()));

  return { data: groupOperationRows(pendingRows, 'operation_type'), error: null };
}

export async function getOperationChargeActivityPreview(filters = {}) {
  const { data, error } = await getOperationChargeLogs(filters);
  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((row) => ({
      ...row,
      operation_type: row.movement_type ?? 'WAREHOUSE_SERVICE',
      charge_type: row.movement_subtype ?? filters.chargeType ?? 'OTHER',
      billing_relevance_note: 'Operation charge preview',
    })),
    error: null,
  };
}
