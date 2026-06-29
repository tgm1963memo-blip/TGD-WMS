import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import {
  listCustomerStorageRateRules,
  upsertCustomerStorageRateRule,
} from '../../services/customerFacilityUsageService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const EMPTY_FORM = {
  ruleId: '',
  chargeBasis: 'WEIGHT',
  temperatureType: 'FROZEN',
  rate: '',
  note: '',
};

export function CustomerStorageRateRulesAdminPage() {
  const t = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomers().then((result) => setCustomers(result.data ?? []));
  }, []);

  useEffect(() => {
    if (!customerId) {
      setRules([]);
      return;
    }
    listCustomerStorageRateRules(customerId).then((result) => {
      setRules(result.data ?? []);
      setError(result.error?.message ?? '');
    });
  }, [customerId, success]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await upsertCustomerStorageRateRule({
      ruleId: form.ruleId || null,
      customerId,
      chargeBasis: form.chargeBasis,
      temperatureType: form.temperatureType,
      rate: form.rate,
      note: form.note,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? t('catalog_save_error'));
      return;
    }

    setSuccess(t('storage_rate_save_success'));
    setForm(EMPTY_FORM);
  }

  const columns = [
    { key: 'charge_basis', header: t('catalog_col_charge_basis') },
    {
      key: 'temperature_type',
      header: 'การจัดเก็บ',
      render: (row) => {
        const labels = { CHILLED: 'Chilled — แช่เย็น', FROZEN: 'Frozen — แช่แข็ง', FREEZE: 'Freeze — ฝากฟรีส' };
        return labels[row.temperature_type] ?? row.temperature_type ?? '-';
      },
    },
    { key: 'rate', header: t('storage_rate_col_rate') },
    { key: 'currency', header: t('storage_rate_col_currency') },
    { key: 'is_active', header: t('catalog_col_status') },
    {
      key: 'actions',
      header: t('catalog_col_actions'),
      render: (row) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setForm({
            ruleId: row.id,
            chargeBasis: row.charge_basis,
            temperatureType: row.temperature_type ?? 'FROZEN',
            rate: String(row.rate ?? ''),
            note: row.note ?? '',
          })}
          type="button"
        >
          {t('edit')}
        </button>
      ),
    },
  ];

  return (
    <section className="page-shell" data-testid="customer-storage-rate-rules-admin-page">
      <PageHeader title={t('storage_rate_admin_title')} description={t('storage_rate_admin_description')} />

      <div className="form-grid filter-row">
        <label className="form-field">
          <span>{t('catalog_filter_customer')}</span>
          <select className="form-control" data-testid="storage-rate-customer-filter" onChange={(e) => setCustomerId(e.target.value)} value={customerId}>
            <option value="">{t('catalog_all_customers')}</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      {customerId ? (
        <form className="form-card" data-testid="storage-rate-admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>{t('catalog_col_charge_basis')}</span>
              <select className="form-control" onChange={(e) => setForm((c) => ({ ...c, chargeBasis: e.target.value }))} value={form.chargeBasis}>
                <option value="WEIGHT">WEIGHT</option>
                <option value="PALLET">PALLET</option>
              </select>
            </label>
            <label className="form-field">
              <span>การจัดเก็บ (Temperature Type)</span>
              <select className="form-control" onChange={(e) => setForm((c) => ({ ...c, temperatureType: e.target.value }))} value={form.temperatureType}>
                <option value="CHILLED">Chilled — แช่เย็น</option>
                <option value="FROZEN">Frozen — แช่แข็ง</option>
                <option value="FREEZE">Freeze — ฝากฟรีส</option>
              </select>
            </label>
            <label className="form-field">
              <span>{t('storage_rate_col_rate')}</span>
              <input className="form-control" min="0" onChange={(e) => setForm((c) => ({ ...c, rate: e.target.value }))} required step="0.01" type="number" value={form.rate} />
            </label>
            <label className="form-field form-field-span-2">
              <span>{t('catalog_col_note')}</span>
              <input className="form-control" onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} value={form.note} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? t('catalog_saving') : t('save')}</button>
        </form>
      ) : null}

      <DataTable columns={columns} data={rules} emptyMessage={t('storage_rate_empty')} loading={false} testId="storage-rate-admin-table" />
    </section>
  );
}
