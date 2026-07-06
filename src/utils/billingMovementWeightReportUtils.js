export const BILLING_MOVEMENT_WEIGHT_CSV_HEADERS = [
  'movement_date',
  'movement_type',
  'canonical_movement_type',
  'customer_name',
  'product_code',
  'product_name',
  'temperature_type',
  'lot_no',
  'pallet_no',
  'qty',
  'uom',
  'net_weight',
  'gross_weight',
  'chargeable_weight',
  'is_billable',
  'billing_service_type',
  'billing_status',
  'billing_exclusion_reason',
  'source_document_no',
];

export function applyBillingMovementWeightFilters(rows = [], filters = {}) {
  return rows.filter((row) => {
    if (filters.customerId && row.customer_id !== filters.customerId) return false;
    if (filters.productId && row.product_id !== filters.productId) return false;
    if (filters.temperatureType && row.temperature_type !== filters.temperatureType) return false;

    if (filters.movementType) {
      const filterType = String(filters.movementType).trim().toUpperCase();
      const movementType = String(row.movement_type ?? '').toUpperCase();
      const canonicalType = String(row.canonical_movement_type ?? '').toUpperCase();
      if (movementType !== filterType && canonicalType !== filterType) return false;
    }

    if (filters.billingStatus && row.billing_status !== filters.billingStatus) return false;

    if (filters.isBillable === 'true' && !row.is_billable) return false;
    if (filters.isBillable === 'false' && row.is_billable) return false;
    if (filters.billableOnly && !row.is_billable) return false;

    if (filters.dateFrom) {
      const movementTime = new Date(row.movement_date ?? 0).getTime();
      if (movementTime < new Date(filters.dateFrom).getTime()) return false;
    }

    if (filters.dateTo) {
      const movementTime = new Date(row.movement_date ?? 0).getTime();
      const endOfDay = new Date(`${filters.dateTo}T23:59:59.999`);
      if (movementTime > endOfDay.getTime()) return false;
    }

    return true;
  });
}

export function calculateBillingMovementWeightSummary(rows = []) {
  const totalMovements = rows.length;
  const billableMovements = rows.filter((row) => row.is_billable).length;

  return {
    totalMovements,
    billableMovements,
    excludedMovements: totalMovements - billableMovements,
    totalQty: rows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0),
    totalNetWeight: rows.reduce((sum, row) => sum + Number(row.net_weight ?? 0), 0),
    totalGrossWeight: rows.reduce((sum, row) => sum + Number(row.gross_weight ?? 0), 0),
    totalChargeableWeight: rows.reduce((sum, row) => sum + Number(row.chargeable_weight ?? 0), 0),
    needsWeightReviewCount: rows.filter((row) => row.billing_status === 'NEEDS_WEIGHT_REVIEW').length,
  };
}

export function classifyBillingMovementWeightError(error) {
  const message = error?.message ?? String(error ?? 'Unknown error');
  const code = error?.code ?? '';

  if (
    code === 'PGRST205'
    || /schema cache/i.test(message)
    || /Could not find the table/i.test(message)
  ) {
    return {
      type: 'schema_cache',
      title: 'PostgREST schema cache issue',
      message: 'View exists in Postgres but frontend cannot read it yet. Refresh Supabase API schema cache or verify grants.',
    };
  }

  if (/permission denied|row-level security|RLS/i.test(message)) {
    return {
      type: 'rls_block',
      title: 'RLS / permission blocked',
      message: 'Authenticated or anon role cannot read billing movement weight view. Review RLS/grant policy on UAT only.',
    };
  }

  if (/not configured/i.test(message)) {
    return {
      type: 'config',
      title: 'Supabase not configured',
      message: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before loading this report.',
    };
  }

  return {
    type: 'unknown',
    title: 'Unable to load billing movement weight report',
    message,
  };
}

function escapeCsvValue(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildBillingMovementWeightCsv(rows = []) {
  const headerLine = BILLING_MOVEMENT_WEIGHT_CSV_HEADERS.join(',');
  const dataLines = rows.map((row) => BILLING_MOVEMENT_WEIGHT_CSV_HEADERS
    .map((key) => escapeCsvValue(row[key]))
    .join(','));

  return [headerLine, ...dataLines].join('\n');
}

export function downloadBillingMovementWeightCsv(rows = [], filename = 'billing-movement-weight-report.csv') {
  const csv = buildBillingMovementWeightCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
