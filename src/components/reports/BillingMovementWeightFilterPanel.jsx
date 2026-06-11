import { useState } from 'react';

const initialFilters = {
  dateFrom: '',
  dateTo: '',
  customerId: '',
  productId: '',
  movementType: '',
  billingStatus: '',
  isBillable: '',
};

const BILLING_STATUS_OPTIONS = [
  '',
  'READY_FOR_PREVIEW',
  'NEEDS_WEIGHT_REVIEW',
  'EXCLUDED',
];

export function BillingMovementWeightFilterPanel({
  value = initialFilters,
  onChange,
  customers = [],
  products = [],
}) {
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
    <section
      className="filter-toolbar"
      aria-label="Billing movement weight filters"
      data-testid="billing-movement-weight-filter-form"
    >
      <div
        className="filter-toolbar-group"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', width: '100%', flex: 1 }}
      >
        <div className="form-group">
          <label className="form-label">
            Date From
            <input className="form-control" name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Date To
            <input className="form-control" name="dateTo" type="date" value={filters.dateTo} onChange={updateField} />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Customer
            <select className="form-control" name="customerId" value={filters.customerId} onChange={updateField}>
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name ?? customer.customer_name ?? customer.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Product
            <select className="form-control" name="productId" value={filters.productId} onChange={updateField}>
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku ?? product.product_code ?? product.name ?? product.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Movement Type
            <input className="form-control" name="movementType" value={filters.movementType} onChange={updateField} placeholder="RECEIVE_CONFIRM" />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Billing Status
            <select className="form-control" name="billingStatus" value={filters.billingStatus} onChange={updateField}>
              {BILLING_STATUS_OPTIONS.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status || 'All statuses'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">
            Is Billable
            <select className="form-control" name="isBillable" value={filters.isBillable} onChange={updateField}>
              <option value="">All</option>
              <option value="true">Billable only</option>
              <option value="false">Excluded only</option>
            </select>
          </label>
        </div>
      </div>
      <div className="filter-toolbar-actions">
        <button type="button" className="btn btn-outline" onClick={resetFilters}>Reset</button>
        <button type="button" className="btn btn-primary-gold" onClick={() => onChange?.(filters)}>Search</button>
      </div>
    </section>
  );
}
