import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CUSTOMER_WITHDRAWAL_STATUSES } from '../../data/customerPortalDemoData.js';
import {
  createCustomerWithdrawalRequest,
  upsertCustomerWithdrawalRequestLine,
} from '../../services/customerWithdrawalRequestService.js';
import { listCustomerDepositRequests } from '../../services/customerDepositRequestService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  requested_dispatch_date: '',
  source_deposit_request_id: '',
  lot_no: '',
  customer_product_code: '',
  internal_product_code: '',
  product_name: '',
  requested_qty: '',
  requested_boxes: '',
  requested_weight: '',
  picking_rule: 'FEFO',
  delivery_type: 'PICKUP',
  pickup_contact: '',
  destination: '',
  note: '',
};

export function CustomerWithdrawalRequestPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests } = useCustomerPortalProfile();
  const [form, setForm] = useState(INITIAL_FORM);
  const [depositOptions, setDepositOptions] = useState([]);
  const [success, setSuccess] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!customerId) {
      setDepositOptions([]);
      return undefined;
    }

    listCustomerDepositRequests({ customerId }).then((result) => {
      if (!active) return;
      setDepositOptions(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [customerId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(null);
    setSubmitError('');
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

    const createResult = await createCustomerWithdrawalRequest({
      requestedDispatchDate: form.requested_dispatch_date,
      deliveryType: form.delivery_type,
      pickupContact: form.pickup_contact,
      destination: form.destination,
      note: form.note,
    });

    if (createResult.error) {
      setSubmitting(false);
      setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;
    const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
      sourceDepositRequestId: form.source_deposit_request_id || null,
      sourceLotNo: form.lot_no,
      customerProductCode: form.customer_product_code,
      internalProductCode: form.internal_product_code,
      productName: form.product_name,
      requestedQty: form.requested_qty,
      requestedBoxes: form.requested_boxes,
      requestedWeight: form.requested_weight,
      pickingRule: form.picking_rule,
      note: form.note,
    });

    setSubmitting(false);

    if (lineResult.error) {
      setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    setSuccess({
      requestNo: createResult.data?.withdrawal_no ?? requestId,
    });
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-page">
      <PageHeader title={t('customer_withdrawal_title')} description={t('customer_withdrawal_description')} />
      <CustomerPortalLiveBanner />

      <div className="customer-process-card">
        <h3>Withdrawal status timeline</h3>
        <CustomerProcessTimeline statuses={CUSTOMER_WITHDRAWAL_STATUSES} testId="customer-withdrawal-status-timeline" />
      </div>

      {success ? (
        <div className="alert-success-panel" data-testid="customer-withdrawal-live-success-alert" role="status">
          {t('customer_withdrawal_live_success')} ({success.requestNo})
        </div>
      ) : null}

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-withdrawal-request-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Source deposit request</span>
            <select
              className="form-control"
              data-testid="withdrawal-source-deposit-select"
              onChange={(e) => updateField('source_deposit_request_id', e.target.value)}
              value={form.source_deposit_request_id}
            >
              <option value="">Optional source deposit</option>
              {depositOptions.map((row) => (
                <option key={row.id} value={row.id}>{row.request_no} ({row.status})</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Source lot</span>
            <input className="form-control" data-testid="withdrawal-lot-select" onChange={(e) => updateField('lot_no', e.target.value)} value={form.lot_no} />
          </label>
          <label className="form-field">
            <span>Picking rule</span>
            <select className="form-control" data-testid="withdrawal-picking-rule-select" onChange={(e) => updateField('picking_rule', e.target.value)} value={form.picking_rule}>
              <option value="FEFO">FEFO</option>
              <option value="SPECIFIC_DEPOSIT">SPECIFIC_DEPOSIT</option>
              <option value="SPECIFIC_LOT">SPECIFIC_LOT</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t('customer_field_requested_dispatch_date')}</span>
            <input className="form-control" data-testid="customer-withdrawal-dispatch-date" onChange={(e) => updateField('requested_dispatch_date', e.target.value)} required type="date" value={form.requested_dispatch_date} />
          </label>
          <label className="form-field">
            <span>Customer product code</span>
            <input className="form-control" data-testid="customer-withdrawal-product-code" onChange={(e) => updateField('customer_product_code', e.target.value)} required value={form.customer_product_code} />
          </label>
          <label className="form-field">
            <span>Internal product code</span>
            <input className="form-control" onChange={(e) => updateField('internal_product_code', e.target.value)} value={form.internal_product_code} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_product_name')}</span>
            <input className="form-control" data-testid="customer-withdrawal-product-name" onChange={(e) => updateField('product_name', e.target.value)} required value={form.product_name} />
          </label>
          <label className="form-field">
            <span>Requested quantity</span>
            <input className="form-control" data-testid="customer-withdrawal-qty" min="1" onChange={(e) => updateField('requested_qty', e.target.value)} required type="number" value={form.requested_qty} />
          </label>
          <label className="form-field">
            <span>Requested boxes</span>
            <input className="form-control" min="0" onChange={(e) => updateField('requested_boxes', e.target.value)} type="number" value={form.requested_boxes} />
          </label>
          <label className="form-field">
            <span>Requested weight (kg)</span>
            <input className="form-control" min="0" onChange={(e) => updateField('requested_weight', e.target.value)} step="0.01" type="number" value={form.requested_weight} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_delivery_type')}</span>
            <select className="form-control" onChange={(e) => updateField('delivery_type', e.target.value)} value={form.delivery_type}>
              <option value="PICKUP">PICKUP</option>
              <option value="DELIVERY">DELIVERY</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t('customer_field_pickup_contact')}</span>
            <input className="form-control" data-testid="customer-withdrawal-pickup-contact" onChange={(e) => updateField('pickup_contact', e.target.value)} required value={form.pickup_contact} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_destination')}</span>
            <input className="form-control" onChange={(e) => updateField('destination', e.target.value)} value={form.destination} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateField('note', e.target.value)} rows={3} value={form.note} />
          </label>
        </div>
        <div className="action-row customer-portal-form-actions">
          <button className="btn btn-secondary" onClick={() => { setForm(INITIAL_FORM); setSuccess(null); setSubmitError(''); }} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="customer-withdrawal-submit-button" disabled={submitting} type="submit">
            {submitting ? t('customer_withdrawal_submitting') : t('customer_withdrawal_submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
