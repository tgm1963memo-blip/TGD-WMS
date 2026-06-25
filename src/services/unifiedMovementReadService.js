import {
  INVENTORY_LEDGER_SOURCE,
  STOCK_LEDGER_SOURCE,
  isDraftMovement,
  normalizeMovementType,
  resolveBillingEligibility,
} from '../constants/movementTypeMapping.js';
import { resolveMovementWeights } from '../utils/billingWeightUtils.js';
import { resolveQuantity, resolveUom, resolveWeight } from '../utils/stockFieldAliases.js';
import { supabase } from './supabaseClient.js';

export const UNIFIED_MOVEMENT_VIEW_NAME = 'tgd_unified_movements_v';

const STOCK_MOVEMENT_SELECT = `
  id,
  customer_id,
  product_id,
  lot_id,
  tgd_lots(lot_number),
  from_location_id,
  to_location_id,
  quantity,
  weight,
  movement_type,
  movement_date,
  related_document_id,
  source_module,
  source_document_id,
  source_line_id,
  created_at,
  updated_at
`;

const INVENTORY_MOVEMENT_SELECT = `
  id,
  movement_no,
  movement_type,
  movement_subtype,
  customer_id,
  product_id,
  lot_id,
  from_warehouse_id,
  from_location_id,
  from_pallet_id,
  to_warehouse_id,
  to_location_id,
  to_pallet_id,
  qty,
  uom,
  reference_type,
  reference_no,
  reference_id,
  reason_code,
  remark,
  created_by,
  created_at,
  is_reversed,
  reversed_by_movement_id
`;

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function enrichNormalizedMovementRow(normalized, context = {}) {
  const eligibility = resolveBillingEligibility(normalized);
  const weights = resolveMovementWeights(normalized, context);

  return {
    ...normalized,
    canonical_movement_type: eligibility.canonical_movement_type,
    is_billable: eligibility.is_billable,
    billing_exclusion_reason: eligibility.billing_exclusion_reason,
    billing_service_type: eligibility.billing_service_type,
    is_billing_source: eligibility.is_billable,
    net_weight: weights.net_weight,
    gross_weight: weights.gross_weight,
    chargeable_weight: weights.chargeable_weight,
    weight_per_unit: weights.weight_per_unit,
    pallet_weight: weights.pallet_weight,
    billing_status: weights.billing_status,
    source_document_type: normalized.source_module ?? normalized.reference_type ?? null,
    source_document_no: normalized.source_document_no ?? normalized.reference_no ?? null,
  };
}

export function normalizeStockMovementRow(row = {}, context = {}) {
  const movementTypeRaw = row.movement_type ?? null;
  const movementTypeCanonical = normalizeMovementType(movementTypeRaw);
  const normalized = {
    id: row.id,
    ledger_source: STOCK_LEDGER_SOURCE,
    movement_type_raw: movementTypeRaw,
    movement_type: movementTypeCanonical,
    movement_type_canonical: movementTypeCanonical,
    movement_subtype: null,
    movement_no: null,
    customer_id: row.customer_id ?? null,
    product_id: row.product_id ?? null,
    lot_id: row.lot_id ?? null,
    lot_no: row.tgd_lots?.lot_number ?? null,
    from_warehouse_id: null,
    from_location_id: row.from_location_id ?? null,
    from_pallet_id: null,
    to_warehouse_id: null,
    to_location_id: row.to_location_id ?? null,
    to_pallet_id: null,
    qty: resolveQuantity(row),
    quantity: resolveQuantity(row),
    uom: resolveUom(row),
    weight: resolveWeight(row),
    chargeable_weight: resolveWeight(row),
    movement_date: row.movement_date ?? row.created_at ?? null,
    source_module: row.source_module ?? null,
    source_document_id: row.source_document_id ?? row.related_document_id ?? null,
    source_line_id: row.source_line_id ?? null,
    related_document_id: row.related_document_id ?? null,
    reference_type: row.source_module ?? 'STOCK_MOVEMENT',
    reference_no: null,
    reference_id: row.source_document_id ?? row.related_document_id ?? null,
    reason_code: null,
    remark: null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    is_reversed: false,
    reversed_by_movement_id: null,
    is_draft: isDraftMovement({ movement_type_raw: movementTypeRaw, source_document_status: row.document_status }),
    source_document_no: row.source_document_no ?? null,
  };

  return enrichNormalizedMovementRow(normalized, context);
}

export function normalizeInventoryMovementRow(row = {}, context = {}) {
  const movementTypeRaw = row.movement_type ?? null;
  const movementTypeCanonical = normalizeMovementType(movementTypeRaw);
  const normalized = {
    id: row.id,
    ledger_source: INVENTORY_LEDGER_SOURCE,
    movement_type_raw: movementTypeRaw,
    movement_type: movementTypeCanonical,
    movement_type_canonical: movementTypeCanonical,
    movement_subtype: row.movement_subtype ?? null,
    movement_no: row.movement_no ?? null,
    customer_id: row.customer_id ?? null,
    product_id: row.product_id ?? null,
    lot_id: row.lot_id ?? null,
    lot_no: row.tgd_lots?.lot_number ?? null,
    from_warehouse_id: row.from_warehouse_id ?? null,
    from_location_id: row.from_location_id ?? null,
    from_pallet_id: row.from_pallet_id ?? null,
    to_warehouse_id: row.to_warehouse_id ?? null,
    to_location_id: row.to_location_id ?? null,
    to_pallet_id: row.to_pallet_id ?? null,
    qty: resolveQuantity(row),
    quantity: resolveQuantity(row),
    uom: resolveUom(row),
    weight: resolveWeight(row),
    chargeable_weight: resolveWeight(row),
    movement_date: row.created_at ?? null,
    source_module: row.reference_type ?? null,
    source_document_id: row.reference_id ?? null,
    source_line_id: null,
    related_document_id: row.reference_id ?? null,
    reference_type: row.reference_type ?? null,
    reference_no: row.reference_no ?? null,
    reference_id: row.reference_id ?? null,
    reason_code: row.reason_code ?? null,
    remark: row.remark ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    is_reversed: Boolean(row.is_reversed),
    reversed_by_movement_id: row.reversed_by_movement_id ?? null,
    is_draft: isDraftMovement(row),
    source_document_no: row.reference_no ?? null,
  };

  return enrichNormalizedMovementRow(normalized, context);
}

export function mergeUnifiedMovementRows(stockRows = [], inventoryRows = []) {
  const merged = [
    ...stockRows.map(normalizeStockMovementRow),
    ...inventoryRows.map(normalizeInventoryMovementRow),
  ];

  return merged.sort((left, right) => {
    const leftTime = new Date(left.movement_date ?? left.created_at ?? 0).getTime();
    const rightTime = new Date(right.movement_date ?? right.created_at ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function applyUnifiedFilters(rows = [], filters = {}) {
  return rows.filter((row) => {
    if (filters.customerId && row.customer_id !== filters.customerId) return false;
    if (filters.productId) {
      if (Array.isArray(filters.productId)) {
        if (!filters.productId.includes(row.product_id)) return false;
      } else {
        if (row.product_id !== filters.productId) return false;
      }
    }
    if (filters.movementType) {
      const canonical = normalizeMovementType(filters.movementType);
      if (row.movement_type_canonical !== canonical && row.movement_type_raw !== filters.movementType) return false;
    }
    if (filters.billableOnly && !row.is_billing_source) return false;
    if (filters.excludeDraft && row.is_draft) return false;
    if (filters.sourceModule && row.source_module !== filters.sourceModule) return false;
    if (filters.sourceDocumentId && row.source_document_id !== filters.sourceDocumentId) return false;
    if (filters.referenceType && row.reference_type !== filters.referenceType) return false;
    if (filters.referenceNo && row.reference_no !== filters.referenceNo) return false;
    if (filters.referenceId && row.reference_id !== filters.referenceId) return false;

    if (filters.dateFrom) {
      const movementTime = new Date(row.movement_date ?? row.created_at ?? 0).getTime();
      if (movementTime < new Date(filters.dateFrom).getTime()) return false;
    }

    if (filters.dateTo) {
      const movementTime = new Date(row.movement_date ?? row.created_at ?? 0).getTime();
      if (movementTime > new Date(filters.dateTo).getTime()) return false;
    }

    if (filters.locationId) {
      const matchesLocation = row.from_location_id === filters.locationId || row.to_location_id === filters.locationId;
      if (!matchesLocation) return false;
    }

    if (filters.warehouseId) {
      const matchesWarehouse = row.from_warehouse_id === filters.warehouseId || row.to_warehouse_id === filters.warehouseId;
      if (!matchesWarehouse) return false;
    }

    return true;
  });
}

async function readStockMovements(filters = {}) {
  if (!supabase) return { data: [], error: null };

  let query = supabase
    .from('tgd_stock_movements')
    .select(STOCK_MOVEMENT_SELECT)
    .order('created_at', { ascending: false });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.productId) {
    if (Array.isArray(filters.productId)) {
      query = query.in('product_id', filters.productId);
    } else {
      query = query.eq('product_id', filters.productId);
    }
  }
  if (filters.sourceDocumentId) query = query.eq('source_document_id', filters.sourceDocumentId);
  if (filters.sourceModule) query = query.eq('source_module', filters.sourceModule);
  if (filters.movementType) query = query.eq('movement_type', filters.movementType);
  if (filters.dateFrom) query = query.gte('movement_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('movement_date', filters.dateTo);

  return query;
}

async function readInventoryMovements(filters = {}) {
  if (!supabase) return { data: [], error: null };

  let query = supabase
    .from('tgd_inventory_movements')
    .select(INVENTORY_MOVEMENT_SELECT)
    .order('created_at', { ascending: false });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.productId) {
    if (Array.isArray(filters.productId)) {
      query = query.in('product_id', filters.productId);
    } else {
      query = query.eq('product_id', filters.productId);
    }
  }
  if (filters.movementType) query = query.eq('movement_type', filters.movementType);
  if (filters.referenceType) query = query.eq('reference_type', filters.referenceType);
  if (filters.referenceNo) query = query.eq('reference_no', filters.referenceNo);
  if (filters.referenceId) query = query.eq('reference_id', filters.referenceId);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  return query;
}

async function readFromDatabaseView(filters = {}) {
  if (!supabase) return { data: null, error: null, usedView: false };

  let query = supabase
    .from(UNIFIED_MOVEMENT_VIEW_NAME)
    .select('*')
    .order('movement_date', { ascending: false });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.productId) {
    if (Array.isArray(filters.productId)) {
      query = query.in('product_id', filters.productId);
    } else {
      query = query.eq('product_id', filters.productId);
    }
  }
  if (filters.sourceDocumentId) query = query.eq('source_document_id', filters.sourceDocumentId);
  if (filters.sourceModule) query = query.eq('source_module', filters.sourceModule);

  const result = await query;
  if (result.error) {
    return { data: null, error: result.error, usedView: false };
  }

  return { data: result.data ?? [], error: null, usedView: true };
}

export async function getUnifiedMovementRows(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const viewResult = await readFromDatabaseView(filters);
  if (viewResult.usedView && !viewResult.error) {
    const rows = (viewResult.data ?? []).map((row) => enrichNormalizedMovementRow({
      ...row,
      qty: resolveQuantity(row),
      quantity: resolveQuantity(row),
      movement_type_canonical: row.movement_type_canonical ?? normalizeMovementType(row.movement_type_raw ?? row.movement_type),
      is_draft: Boolean(row.is_draft ?? isDraftMovement(row)),
    }));

    return { data: applyUnifiedFilters(rows, filters), error: null, source: 'database_view' };
  }

  const [stockResult, inventoryResult] = await Promise.all([
    readStockMovements(filters),
    readInventoryMovements(filters),
  ]);

  if (stockResult.error) return { data: null, error: stockResult.error, source: 'client_merge' };
  if (inventoryResult.error) return { data: null, error: inventoryResult.error, source: 'client_merge' };

  const merged = mergeUnifiedMovementRows(stockResult.data ?? [], inventoryResult.data ?? []);
  return {
    data: applyUnifiedFilters(merged, filters),
    error: null,
    source: 'client_merge',
  };
}

export async function getBillableMovementRows(filters = {}) {
  return getUnifiedMovementRows({
    ...filters,
    billableOnly: true,
    excludeDraft: true,
  });
}

export async function getReceivingConfirmedUnifiedMovements(documentId, filters = {}) {
  if (!documentId) {
    return {
      data: [],
      error: new Error('documentId is required to read receiving confirmed movements.'),
      source: 'client_merge',
    };
  }

  return getUnifiedMovementRows({
    ...filters,
    sourceModule: 'RECEIVING',
    sourceDocumentId: documentId,
    excludeDraft: true,
  });
}
