import { useState, useEffect } from 'react';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown.jsx';
import { TEMPERATURE_TYPE_LABELS } from '../../utils/temperatureTypeLabels.js';

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
  temperatureType: [],
};

const temperatureOptions = [
  ...Object.entries(TEMPERATURE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  { value: '-', label: 'ไม่มีระบุ (-)' },
];

export function ReportFilterPanel({
  value = initialFilters,
  onChange,
  customerOptions = null,
  productOptions = null,
  locationOptions = null,
  showMovementType = true,
  multiProduct = false,
  multiLocation = false,
}) {
  const [filters, setFilters] = useState({ ...initialFilters, ...value, productId: multiProduct ? (Array.isArray(value.productId) ? value.productId : []) : (value.productId || ''), locationId: multiLocation ? (Array.isArray(value.locationId) ? value.locationId : []) : (value.locationId || '') });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, productId: multiProduct ? [] : '', locationId: multiLocation ? [] : '' }));
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
      <div className="filter-toolbar-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', width: '100%', flex: 1, alignItems: 'start' }}>
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
              multiProduct ? (
                <MultiSelectDropdown
                  name="productId"
                  options={productOptions}
                  value={filters.productId}
                  onChange={(val) => setFilters((prev) => ({ ...prev, productId: val }))}
                  placeholder="— ทั้งหมด —"
                />
              ) : (
                <select
                  className="form-control"
                  name="productId"
                  value={filters.productId}
                  onChange={updateField}
                >
                  <option value="">— ทั้งหมด —</option>
                  {productOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )
            ) : (
              <input className="form-control" name="productId" value={filters.productId} onChange={updateField} placeholder="Product ID" />
            )}
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Location
            {locationOptions ? (
              multiLocation ? (
                <MultiSelectDropdown
                  name="locationId"
                  options={locationOptions}
                  value={filters.locationId}
                  onChange={(val) => setFilters((prev) => ({ ...prev, locationId: val }))}
                  placeholder="— ทั้งหมด —"
                />
              ) : (
                <select className="form-control" name="locationId" value={filters.locationId} onChange={updateField}>
                  <option value="">— ทั้งหมด —</option>
                  {locationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )
            ) : (
              <input className="form-control" name="locationId" value={filters.locationId} onChange={updateField} placeholder="Location ID" />
            )}
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            อุณหภูมิ
            <MultiSelectDropdown
              name="temperatureType"
              options={temperatureOptions}
              value={filters.temperatureType}
              onChange={(val) => setFilters((prev) => ({ ...prev, temperatureType: val }))}
              placeholder="— ทั้งหมด —"
            />
          </label>
        </div>
        <div className="form-group"><label className="form-label">Warehouse<input className="form-control" name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label></div>
        <div className="form-group"><label className="form-label">Reference Type<input className="form-control" name="referenceType" value={filters.referenceType} onChange={updateField} /></label></div>
      </div>
      <div className="filter-toolbar-actions">
        <button type="button" className="btn btn-outline" onClick={resetFilters}>Reset</button>
        <button type="button" className="btn btn-primary-gold" onClick={handleSearch}>Search</button>
      </div>
    </section>
  );
}
