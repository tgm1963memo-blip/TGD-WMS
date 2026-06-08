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
    <section className="section-card filter-grid" aria-label="Document filters" style={{ marginBottom: '16px' }}>
      <label className="form-label">{t('search') || 'Search'}<input className="form-control" name="search" value={filters.search} onChange={updateField} /></label>
      <label className="form-label">{t('status') || 'Status'}<input className="form-control" name="status" value={filters.status} onChange={updateField} /></label>
      <label className="form-label">{t('type') || 'Type'}<input className="form-control" name="type" value={filters.type} onChange={updateField} /></label>
      <label className="form-label">{t('date_from') || 'Date From'}<input className="form-control" name="dateFrom" type="date" value={filters.dateFrom} onChange={updateField} /></label>
      <label className="form-label">{t('date_to') || 'Date To'}<input className="form-control" name="dateTo" type="date" value={filters.dateTo} onChange={updateField} /></label>
      <label className="form-label">{t('customer') || 'Customer'}<input className="form-control" name="customerId" value={filters.customerId} onChange={updateField} placeholder={t('select_customer') || 'Customer ID'} /></label>
      <label className="form-label">{t('warehouse') || 'Warehouse'}<input className="form-control" name="warehouseId" value={filters.warehouseId} onChange={updateField} placeholder="Warehouse ID" /></label>
      <button type="button" className="btn" onClick={resetFilters} style={{ alignSelf: 'end', background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}>{t('reset') || 'Reset'}</button>
    </section>
  );
}
