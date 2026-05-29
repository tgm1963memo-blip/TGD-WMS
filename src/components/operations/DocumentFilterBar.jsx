import { useState } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const initialFilters = {
  search: '',
  status: '',
  type: '',
  dateFrom: '',
  dateTo: '',
  customerId: '',
  warehouseId: '',
};

export function DocumentFilterBar({ value = initialFilters, onChange }) {
  const [filters, setFilters] = useState({ ...initialFilters, ...value });
  const t = useTranslation();

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
      className="document-filter-bar"
      aria-label="Document filters"
      style={{
        background: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: 8,
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        padding: 16,
      }}
    >
      <label style={labelStyle}>{t('search') || 'Search'}<input style={inputStyle} name="search" value={filters.search} onChange={updateField} /></label>
      <label style={labelStyle}>{t('status') || 'Status'}<input style={inputStyle} name="status" value={filters.status} onChange={updateField} /></label>
      <label style={labelStyle}>{t('type') || 'Type'}<input style={inputStyle} name="type" value={filters.type} onChange={updateField} /></label>
      <label style={labelStyle}>{t('date_from') || 'Date From'}<input style={inputStyle} name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} /></label>
      <label style={labelStyle}>{t('date_to') || 'Date To'}<input style={inputStyle} name="dateTo" type="date" value={filters.dateTo} onChange={updateField} /></label>
      <label style={labelStyle}>{t('customer') || 'Customer'}<input style={inputStyle} name="customerId" value={filters.customerId} onChange={updateField} placeholder={t('select_customer') || 'Customer ID'} /></label>
      <label style={labelStyle}>{t('warehouse') || 'Warehouse'}<input style={inputStyle} name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label>
      <button type="button" onClick={resetFilters} style={buttonStyle}>{t('reset') || 'Reset'}</button>
    </section>
  );
}

const labelStyle = {
  color: '#334e68',
  display: 'grid',
  fontSize: 13,
  fontWeight: 700,
  gap: 6,
};

const inputStyle = {
  border: '1px solid #bcccdc',
  borderRadius: 7,
  minHeight: 38,
  padding: '8px 10px',
};

const buttonStyle = {
  alignSelf: 'end',
  background: '#f0f4f8',
  border: '1px solid #d9e2ec',
  borderRadius: 7,
  color: '#334e68',
  cursor: 'pointer',
  fontWeight: 700,
  minHeight: 38,
  padding: '8px 12px',
};
