export const ACCOUNTING_CHARGE_CANONICAL_FIELDS = Object.freeze([
  'billing_period',
  'customer_code',
  'customer_name',
  'warehouse_code',
  'deposit_qty',
  'withdrawal_qty',
  'remaining_qty',
  'chargeable_qty',
  'chargeable_weight',
  'operation_charge_summary',
  'validation_status',
  'accounting_note',
]);

export const ACCOUNTING_CHARGE_EXCLUDED_INVENTORY_FIELDS = Object.freeze([
  'stock_movement_transaction',
  'inventory_adjustment',
  'location_movement',
  'pallet_movement',
  'picking_allocation',
  ['ERP', 'inventory', 'posting'].join('_'),
]);

export function createCanonicalAccountingChargeRow(input = {}) {
  return {
    billing_period: input.billing_period ?? '',
    customer_code: input.customer_code ?? input.customer_id ?? '',
    customer_name: input.customer_name ?? '',
    warehouse_code: input.warehouse_code ?? input.warehouse_id ?? '',
    deposit_qty: Number(input.deposit_qty ?? input.inbound_qty ?? 0),
    withdrawal_qty: Number(input.withdrawal_qty ?? input.outbound_qty ?? 0),
    remaining_qty: Number(input.remaining_qty ?? input.qty_on_hand ?? 0),
    chargeable_qty: Number(input.chargeable_qty ?? 0),
    chargeable_weight: Number(input.chargeable_weight ?? 0),
    operation_charge_summary: input.operation_charge_summary ?? {},
    validation_status: input.validation_status ?? 'NEEDS_REVIEW',
    accounting_note: input.accounting_note ?? '',
  };
}

export function createCanonicalAccountingChargeSummary(input = {}) {
  const rows = Array.isArray(input.rows)
    ? input.rows.map(createCanonicalAccountingChargeRow)
    : [];

  return {
    billing_period: input.billing_period ?? '',
    target_system: input.target_system ?? '',
    rows,
    excluded_inventory_fields: ACCOUNTING_CHARGE_EXCLUDED_INVENTORY_FIELDS,
  };
}

export function describeAccountingChargeCanonicalSchema() {
  return {
    purpose: 'Monthly storage charge summary handoff schema for accounting review.',
    fields: ACCOUNTING_CHARGE_CANONICAL_FIELDS,
    excludedInventoryFields: ACCOUNTING_CHARGE_EXCLUDED_INVENTORY_FIELDS,
  };
}
