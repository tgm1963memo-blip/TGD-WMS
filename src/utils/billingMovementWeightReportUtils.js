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
