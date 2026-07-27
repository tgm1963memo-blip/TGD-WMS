import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import {
  createCustomerFacilityUsageRequest,
  listCustomerFacilityUsageRequests,
  submitCustomerFacilityUsageRequest,
} from '../../services/customerFacilityUsageService.js';
import { listAllProductServiceRates, SERVICE_TYPES, UNIT_BASIS } from '../../services/productServiceRatesService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  requested_usage_date: '',
  service_rate_id: '',
  duration_hours: '',
  contact_name: '',
  contact_phone: '',
  note: '',
};

function serviceTypeLabel(value, language) {
  const known = SERVICE_TYPES.find((s) => s.value === value);
  if (!known) return value;
  return language === 'en' ? known.labelEn : known.label;
}

function unitBasisLabel(value) {
  return UNIT_BASIS.find((u) => u.value === value)?.label ?? value;
}

function formatRateOptionLabel(rate, language) {
  const typeLabel = serviceTypeLabel(rate.service_type, language);
  const amount = Number(rate.rate ?? 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${typeLabel} — ${amount} ${rate.currency ?? 'THB'} (${unitBasisLabel(rate.unit_basis)})`;
}

export function CustomerFacilityUsageRequestPage() {
  const t = useTranslation();
  const { language } = useLanguage();
  const { customerId, canWriteCustomerRequests } = useCustomerPortalProfile();
  const [rows, setRows] = useState([]);
  const [rateOptions, setRateOptions] = useState([]);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { sortedData, requestSort, getSortIndicator } = useTableSort(rows);

  async function loadRows() {
    if (!customerId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await listCustomerFacilityUsageRequests({ customerId });
    setRows(result.data ?? []);
    setError(result.error?.message ?? '');
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setRateOptions([]);
      setRatesLoaded(true);
      return undefined;
    }
    let active = true;
    setRatesLoaded(false);
    listAllProductServiceRates({ customerId, isActive: true }).then((result) => {
      if (!active) return;
      setRateOptions(result.data ?? []);
      setRatesLoaded(true);
    });
    return () => { active = false; };
  }, [customerId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const createResult = await createCustomerFacilityUsageRequest({
      requestedUsageDate: form.requested_usage_date,
      serviceRateId: form.service_rate_id,
      durationHours: form.duration_hours,
      contactName: form.contact_name,
      contactPhone: form.contact_phone,
      note: form.note,
    });

    if (createResult.error) {
      setSubmitting(false);
      setError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;
    const submitResult = await submitCustomerFacilityUsageRequest(requestId);
    setSubmitting(false);

    if (submitResult.error) {
      setError(submitResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    setSuccess(`${t('facility_usage_submit_success')} ${createResult.data?.request_no ?? ''}`);
    setForm(INITIAL_FORM);
    await loadRows();
  }

  const columns = [
    { key: 'request_no', header: t('facility_usage_col_request_no') },
    { key: 'status', header: t('customer_col_status') },
    { key: 'usage_type', header: t('facility_usage_col_type') },
    { key: 'requested_usage_date', header: t('facility_usage_col_date') },
    { key: 'duration_hours', header: t('facility_usage_col_duration') },
    {
      key: 'service_rate_amount',
      header: t('facility_usage_col_rate'),
      render: (row) => (row.service_rate_amount != null
        ? `${Number(row.service_rate_amount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB (${unitBasisLabel(row.service_rate_unit_basis)})`
        : '-'),
    },
  ];

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-facility-usage-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  const noRatesConfigured = ratesLoaded && rateOptions.length === 0;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-facility-usage-page">
      <PageHeader title={t('facility_usage_title')} description={t('facility_usage_description')} />
      <CustomerPortalLiveBanner />

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}
      {noRatesConfigured ? (
        <div className="banner banner-warning" role="alert" data-testid="facility-usage-no-rates-banner">
          {t('facility_usage_no_rates_configured')}
        </div>
      ) : null}

      <form className="form-card customer-portal-form" data-testid="customer-facility-usage-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('facility_usage_col_date')}</span>
            <input className="form-control" data-testid="facility-usage-date" onChange={(e) => setForm((c) => ({ ...c, requested_usage_date: e.target.value }))} required type="date" value={form.requested_usage_date} />
          </label>
          <label className="form-field">
            <span>{t('facility_usage_col_type')}</span>
            <select
              className="form-control"
              data-testid="facility-usage-type"
              disabled={noRatesConfigured}
              onChange={(e) => setForm((c) => ({ ...c, service_rate_id: e.target.value }))}
              required
              value={form.service_rate_id}
            >
              <option disabled value="">
                {t('facility_usage_col_type')}
              </option>
              {rateOptions.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {formatRateOptionLabel(rate, language)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t('facility_usage_col_duration')}</span>
            <input className="form-control" min="0" onChange={(e) => setForm((c) => ({ ...c, duration_hours: e.target.value }))} step="0.5" type="number" value={form.duration_hours} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_name')}</span>
            <input className="form-control" onChange={(e) => setForm((c) => ({ ...c, contact_name: e.target.value }))} required value={form.contact_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_phone')}</span>
            <input className="form-control" onChange={(e) => setForm((c) => ({ ...c, contact_phone: e.target.value }))} required value={form.contact_phone} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} rows={2} value={form.note} />
          </label>
        </div>
        <div className="action-row">
          <Link className="btn btn-secondary" to="/customer">{t('close')}</Link>
          <button className="btn btn-primary" data-testid="facility-usage-submit-button" disabled={!canWriteCustomerRequests || submitting || noRatesConfigured || !form.service_rate_id} type="submit">
            {submitting ? t('facility_usage_submitting') : t('facility_usage_submit')}
          </button>
        </div>
      </form>

      <DataTable columns={columns} data={rows} emptyMessage={t('facility_usage_empty')} loading={false} testId="facility-usage-table" />
    </section>
  );
}
