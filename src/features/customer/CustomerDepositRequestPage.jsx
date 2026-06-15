import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CUSTOMER_DEPOSIT_STATUSES } from '../../data/customerPortalDemoData.js';
import {
  createCustomerDepositRequest,
  upsertCustomerDepositRequestLine,
} from '../../services/customerDepositRequestService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const INITIAL_FORM = {
  expected_arrival_date: '',
  customer_product_code: '',
  product_code: '',
  product_name: '',
  lot_no: '',
  expected_qty: '',
  expected_boxes: '',
  expected_weight: '',
  temperature_type: 'FROZEN',
  note: '',
  contact_name: '',
  contact_phone: '',
};

function formatFileSize(size) {
  return `${(size / 1024).toFixed(1)} KB`;
}

export function CustomerDepositRequestPage() {
  const t = useTranslation();
  const { canWriteCustomerRequests } = useCustomerPortalProfile();
  const [form, setForm] = useState(INITIAL_FORM);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [success, setSuccess] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(null);
    setSubmitError('');
  }

  function handleAttachments(event) {
    const selected = Array.from(event.target.files ?? []);
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    setAttachmentError(oversized ? `${oversized.name} exceeds the 10MB preview limit.` : '');
    setAttachments((current) => [
      ...current,
      ...selected.filter((file) => file.size <= MAX_ATTACHMENT_SIZE),
    ]);
    event.target.value = '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSuccess(null);

    if (!canWriteCustomerRequests) {
      setSubmitError(t('customer_portal_no_customer_scope'));
      return;
    }

    setSubmitting(true);

    const createResult = await createCustomerDepositRequest({
      expectedArrivalDate: form.expected_arrival_date,
      contactName: form.contact_name,
      contactPhone: form.contact_phone,
      note: form.note,
    });

    if (createResult.error) {
      setSubmitting(false);
      setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;
    const lineResult = await upsertCustomerDepositRequestLine(requestId, {
      customerProductCode: form.customer_product_code,
      internalProductCode: form.product_code,
      productName: form.product_name,
      lotNo: form.lot_no,
      expectedQty: form.expected_qty,
      expectedBoxes: form.expected_boxes,
      expectedWeight: form.expected_weight,
      temperatureType: form.temperature_type,
      note: form.note,
    });

    setSubmitting(false);

    if (lineResult.error) {
      setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    setSuccess({
      requestNo: createResult.data?.request_no ?? requestId,
    });
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-page">
      <PageHeader title={t('customer_deposit_title')} description={t('customer_deposit_description')} />
      <CustomerPortalLiveBanner />

      <div className="customer-process-card">
        <h3>Deposit status timeline</h3>
        <CustomerProcessTimeline statuses={CUSTOMER_DEPOSIT_STATUSES} testId="customer-deposit-status-timeline" />
      </div>

      {success ? (
        <div className="alert-success-panel" data-testid="customer-deposit-live-success-alert" role="status">
          {t('customer_deposit_live_success')} ({success.requestNo})
        </div>
      ) : null}

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-deposit-request-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Customer product code</span>
            <input className="form-control" data-testid="customer-product-code-input" onChange={(e) => updateField('customer_product_code', e.target.value)} required value={form.customer_product_code} />
          </label>
          <label className="form-field">
            <span>Internal product code</span>
            <input className="form-control" data-testid="customer-deposit-product-code" onChange={(e) => updateField('product_code', e.target.value)} required value={form.product_code} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_product_name')}</span>
            <input className="form-control" data-testid="customer-deposit-product-name" onChange={(e) => updateField('product_name', e.target.value)} required value={form.product_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_lot_no')}</span>
            <input className="form-control" onChange={(e) => updateField('lot_no', e.target.value)} value={form.lot_no} />
          </label>
          <label className="form-field">
            <span>Expected quantity</span>
            <input className="form-control" data-testid="customer-deposit-qty" min="1" onChange={(e) => updateField('expected_qty', e.target.value)} required type="number" value={form.expected_qty} />
          </label>
          <label className="form-field">
            <span>Expected boxes</span>
            <input className="form-control" min="0" onChange={(e) => updateField('expected_boxes', e.target.value)} type="number" value={form.expected_boxes} />
          </label>
          <label className="form-field">
            <span>Expected weight (kg)</span>
            <input className="form-control" min="0" onChange={(e) => updateField('expected_weight', e.target.value)} step="0.01" type="number" value={form.expected_weight} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_expected_arrival_date')}</span>
            <input className="form-control" data-testid="customer-deposit-expected-arrival-date" onChange={(e) => updateField('expected_arrival_date', e.target.value)} required type="date" value={form.expected_arrival_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_temperature_type')}</span>
            <select className="form-control" onChange={(e) => updateField('temperature_type', e.target.value)} value={form.temperature_type}>
              <option value="FROZEN">FROZEN</option>
              <option value="CHILLED">CHILLED</option>
              <option value="AMBIENT">AMBIENT</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_name')}</span>
            <input className="form-control" data-testid="customer-deposit-contact-name" onChange={(e) => updateField('contact_name', e.target.value)} required value={form.contact_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_phone')}</span>
            <input className="form-control" data-testid="customer-deposit-contact-phone" onChange={(e) => updateField('contact_phone', e.target.value)} required value={form.contact_phone} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateField('note', e.target.value)} rows={3} value={form.note} />
          </label>
        </div>

        <div className="customer-attachment-panel">
          <label className="form-field">
            <span>Supporting attachments</span>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
              data-testid="customer-deposit-attachment-input"
              multiple
              onChange={handleAttachments}
              type="file"
            />
          </label>
          <p className="form-helper" data-testid="customer-deposit-attachment-demo-note">
            Storage upload is deferred — files stay in browser preview only until Gate 2G.
          </p>
          {attachmentError ? <p className="field-error" role="alert">{attachmentError}</p> : null}
          <ul className="customer-attachment-list" data-testid="customer-deposit-attachment-list">
            {attachments.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}`}>
                <span>{file.name} ({file.type || 'unknown'}, {formatFileSize(file.size)})</span>
                <button
                  className="btn btn-secondary"
                  data-testid="customer-deposit-attachment-remove-button"
                  onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="action-row customer-portal-form-actions">
          <button className="btn btn-secondary" onClick={() => { setForm(INITIAL_FORM); setAttachments([]); setSuccess(null); setSubmitError(''); }} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="customer-deposit-submit-button" disabled={submitting} type="submit">
            {submitting ? t('customer_deposit_submitting') : t('customer_deposit_submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
