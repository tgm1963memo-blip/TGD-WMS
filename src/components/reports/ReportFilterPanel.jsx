import { useState } from 'react';

const initialFilters = {
  dateFrom: '',
  dateTo: '',
  movementType: '',
  productId: '',
  customerId: '',
  warehouseId: '',
  locationId: '',
  referenceType: '',
};

export function ReportFilterPanel({ value = initialFilters, onChange }) {
  const [filters, setFilters] = useState({ ...initialFilters, ...value });

  function updateField(event) {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    onChange?.(nextFilters);
  }

  function resetFilters() {
    setFilters(initialFilters);
    onChange?.(initialFilters);
  }

  return (
    <section className="document-filter-bar" aria-label="Report filters">
      <label>Date From<input name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} /></label>
      <label>Date To<input name="dateTo" type="date" value={filters.dateTo} onChange={updateField} /></label>
      <label>Movement Type<input name="movementType" value={filters.movementType} onChange={updateField} /></label>
      <label>Product<input name="productId" value={filters.productId} onChange={updateField} placeholder="Product ID" /></label>
      <label>Customer<input name="customerId" value={filters.customerId} onChange={updateField} placeholder="Customer ID" /></label>
      <label>Warehouse<input name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label>
      <label>Location<input name="locationId" value={filters.locationId} onChange={updateField} placeholder="Location ID" /></label>
      <label>Reference Type<input name="referenceType" value={filters.referenceType} onChange={updateField} /></label>
      <button type="button" onClick={resetFilters}>Reset</button>
    </section>
  );
}
