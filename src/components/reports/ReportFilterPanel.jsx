import { useState, useEffect } from 'react';

const initialFilters = {
  dateFrom: '',
  dateTo: '',
  movementType: '',
  productId: '',
  productIds: [],
  customerId: '',
  warehouseId: '',
  locationId: '',
  referenceType: '',
};

export function ReportFilterPanel({
  value = initialFilters,
  onChange,
  customerOptions = null,
  productOptions = null,
  locationOptions = null,
  showMovementType = true,
  multiProduct = false,
}) {
  const [filters, setFilters] = useState({ ...initialFilters, ...value, productId: multiProduct ? [] : (value.productId || '') });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, productId: multiProduct ? [] : '' }));
  }, [filters.customerId]);

  const updateField = (event) => {
    const { name, value, type, selectedOptions } = event.target;
    if (type === 'select-multiple') {
      const values = Array.from(selectedOptions, option => option.value).filter(Boolean);
      setFilters((prev) => ({ ...prev, [name]: values }));
    } else {
      setFilters((prev) => ({ ...prev, [name]: value }));
    }
  };

  function resetFilters() {
    setFilters(initialFilters);
    onChange?.(initialFilters);
  }

  function handleSearch() {
    onChange?.(filters);
  }

  return (
    <section className="filter-toolbar" aria-label="Report filters">
      <div className="filter-toolbar-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', width: '100%', flex: 1 }}>
        <div className="form-group"><label className="form-label">Date From<input className="form-control" name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} /></label></div>
        <div className="form-group"><label className="form-label">Date To<input className="form-control" name="dateTo" type="date" value={filters.dateTo} onChange={updateField} /></label></div>
        {showMovementType && (
          <div className="form-group"><label className="form-label">Movement Type<input className="form-control" name="movementType" value={filters.movementType} onChange={updateField} /></label></div>
        )}
        <div className="form-group">
          <label className="form-label">
            ลูกค้า
            {customerOptions ? (
              <select className="form-control" name="customerId" value={filters.customerId} onChange={updateField}>
                <option value="">— ทั้งหมด —</option>
                {customerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className="form-control" name="customerId" value={filters.customerId} onChange={updateField} placeholder="Customer ID" />
            )}
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            สินค้า
            {productOptions ? (
              <select
                className="form-control"
                name="productId"
                value={filters.productId}
                onChange={updateField}
                multiple={multiProduct}
                style={multiProduct ? { minHeight: '120px' } : undefined}
              >
                {!multiProduct && <option value="">— ทั้งหมด —</option>}
                {multiProduct && <option value="">— ทั้งหมด —</option>}
                {productOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className="form-control" name="productId" value={filters.productId} onChange={updateField} placeholder="Product ID" />
            )}
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Location
            {locationOptions ? (
              <select className="form-control" name="locationId" value={filters.locationId} onChange={updateField}>
                <option value="">— ทั้งหมด —</option>
                {locationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className="form-control" name="locationId" value={filters.locationId} onChange={updateField} placeholder="Location ID" />
            )}
          </label>
        </div>
        <div className="form-group"><label className="form-label">Warehouse<input className="form-control" name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label></div>
        <div className="form-group"><label className="form-label">Reference Type<input className="form-control" name="referenceType" value={filters.referenceType} onChange={updateField} /></label></div>
      </div>
      <div className="filter-toolbar-actions">
        <button type="button" className="btn btn-outline" onClick={resetFilters}>Reset</button>
        <button type="button" className="btn btn-primary-gold" onClick={handleSearch}>Search</button>
        <button type="button" className="btn btn-outline">Export</button>
      </div>
    </section>
  );
}
