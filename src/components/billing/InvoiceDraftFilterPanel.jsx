const STATUS_OPTIONS = [
  '',
  'DRAFT',
  'READY_TO_REVIEW',
  'CANCELLED',
  'APPROVED',
  'EXPORTED_TO_BPLUS',
  'BILLED',
  'ON_HOLD',
];

export function InvoiceDraftFilterPanel({
  value = {},
  onChange,
  customers = [],
}) {
  function updateField(field, nextValue) {
    onChange?.({
      ...value,
      [field]: nextValue,
    });
  }

  return (
    <form
      className="section-card"
      data-testid="invoice-draft-filter-form"
      onSubmit={(event) => event.preventDefault()}
      style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}
    >
      <label>
        Draft No
        <input
          type="search"
          value={value.draftNo ?? ''}
          onChange={(event) => updateField('draftNo', event.target.value)}
          placeholder="Search draft no"
        />
      </label>

      <label>
        Status
        <select value={value.status ?? ''} onChange={(event) => updateField('status', event.target.value)}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status || 'all'} value={status}>
              {status || 'All statuses'}
            </option>
          ))}
        </select>
      </label>

      <label>
        Customer
        <select value={value.customerId ?? ''} onChange={(event) => updateField('customerId', event.target.value)}>
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.customer_name || customer.customer_code || customer.id}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date From
        <input
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(event) => updateField('dateFrom', event.target.value)}
        />
      </label>

      <label>
        Date To
        <input
          type="date"
          value={value.dateTo ?? ''}
          onChange={(event) => updateField('dateTo', event.target.value)}
        />
      </label>
    </form>
  );
}
