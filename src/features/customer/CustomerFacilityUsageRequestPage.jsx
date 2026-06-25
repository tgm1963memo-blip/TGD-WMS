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
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  requested_usage_date: '',
  usage_type: 'STORAGE_AREA',
  duration_hours: '',
  contact_name: '',
  contact_phone: '',
  note: '',
};

export function CustomerFacilityUsageRequestPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests } = useCustomerPortalProfile();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { sortedData, requestSort, getSortIndicator } = useTableSort(state.rows);

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

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const createResult = await createCustomerFacilityUsageRequest({
      requestedUsageDate: form.requested_usage_date,
      usageType: form.usage_type,
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
  ];

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-facility-usage-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-facility-usage-page">
      <PageHeader title={t('facility_usage_title')} description={t('facility_usage_description')} />
      <CustomerPortalLiveBanner />

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-facility-usage-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('facility_usage_col_date')}</span>
            <input className="form-control" data-testid="facility-usage-date" onChange={(e) => setForm((c) => ({ ...c, requested_usage_date: e.target.value }))} required type="date" value={form.requested_usage_date} />
          </label>
          <label className="form-field">
            <span>{t('facility_usage_col_type')}</span>
            <select className="form-control" data-testid="facility-usage-type" onChange={(e) => setForm((c) => ({ ...c, usage_type: e.target.value }))} value={form.usage_type}>
              <option value="STORAGE_AREA">STORAGE_AREA</option>
              <option value="LOADING_DOCK">LOADING_DOCK</option>
              <option value="INSPECTION_ROOM">INSPECTION_ROOM</option>
              <option value="OTHER">OTHER</option>
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
          <button className="btn btn-primary" data-testid="facility-usage-submit-button" disabled={!canWriteCustomerRequests || submitting} type="submit">
            {submitting ? t('facility_usage_submitting') : t('facility_usage_submit')}
          </button>
        </div>
      </form>

      <DataTable columns={columns} data={rows} emptyMessage={t('facility_usage_empty')} loading={false} testId="facility-usage-table" />
    </section>
  );
}
