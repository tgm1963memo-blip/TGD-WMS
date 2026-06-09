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
    <section className="filter-toolbar" aria-label="Report filters">
      <div className="filter-toolbar-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', width: '100%', flex: 1 }}>
        <div className="form-group"><label className="form-label">Date From<input className="form-control" name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} /></label></div>
        <div className="form-group"><label className="form-label">Date To<input className="form-control" name="dateTo" type="date" value={filters.dateTo} onChange={updateField} /></label></div>
        <div className="form-group"><label className="form-label">Movement Type<input className="form-control" name="movementType" value={filters.movementType} onChange={updateField} /></label></div>
        <div className="form-group"><label className="form-label">Product<input className="form-control" name="productId" value={filters.productId} onChange={updateField} placeholder="Product ID" /></label></div>
        <div className="form-group"><label className="form-label">Customer<input className="form-control" name="customerId" value={filters.customerId} onChange={updateField} placeholder="Customer ID" /></label></div>
        <div className="form-group"><label className="form-label">Warehouse<input className="form-control" name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label></div>
        <div className="form-group"><label className="form-label">Location<input className="form-control" name="locationId" value={filters.locationId} onChange={updateField} placeholder="Location ID" /></label></div>
        <div className="form-group"><label className="form-label">Reference Type<input className="form-control" name="referenceType" value={filters.referenceType} onChange={updateField} /></label></div>
      </div>
      <div className="filter-toolbar-actions">
        <button type="button" className="btn btn-outline" onClick={resetFilters}>Reset</button>
        <button type="button" className="btn btn-primary-gold" onClick={() => onChange?.(filters)}>Search</button>
        <button type="button" className="btn btn-outline">Export</button>
      </div>
    </section>
  );
}
