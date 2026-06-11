import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import {
  CUSTOMER_PORTAL_DEMO_DEPOSIT,
  CUSTOMER_WITHDRAWAL_STATUSES,
} from '../../data/customerPortalDemoData.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  requested_dispatch_date: '',
  deposit_request_no: CUSTOMER_PORTAL_DEMO_DEPOSIT.request_no,
  lot_no: CUSTOMER_PORTAL_DEMO_DEPOSIT.lot_no,
  customer_product_code: CUSTOMER_PORTAL_DEMO_DEPOSIT.customer_product_code,
  internal_product_code: CUSTOMER_PORTAL_DEMO_DEPOSIT.internal_product_code,
  product_name: CUSTOMER_PORTAL_DEMO_DEPOSIT.product_name,
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
  const [form, setForm] = useState(INITIAL_FORM);
  const [success, setSuccess] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(false);
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-page">
      <PageHeader title={t('customer_withdrawal_title')} description={t('customer_withdrawal_description')} />
      <CustomerPortalDemoBanner />

      <div className="customer-process-card">
        <h3>Withdrawal status timeline</h3>
        <CustomerProcessTimeline statuses={CUSTOMER_WITHDRAWAL_STATUSES} testId="customer-withdrawal-status-timeline" />
      </div>

      {success ? <div className="alert-success-panel" data-testid="customer-withdrawal-demo-success-alert" role="status">{t('customer_withdrawal_demo_success')}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-withdrawal-request-form" onSubmit={(event) => { event.preventDefault(); setSuccess(true); }}>
        <div className="form-grid">
          <label className="form-field">
            <span>Source deposit request</span>
            <select className="form-control" data-testid="withdrawal-source-deposit-select" onChange={(e) => updateField('deposit_request_no', e.target.value)} value={form.deposit_request_no}>
              <option value={CUSTOMER_PORTAL_DEMO_DEPOSIT.request_no}>{CUSTOMER_PORTAL_DEMO_DEPOSIT.request_no}</option>
            </select>
          </label>
          <label className="form-field">
            <span>Source lot</span>
            <select className="form-control" data-testid="withdrawal-lot-select" onChange={(e) => updateField('lot_no', e.target.value)} value={form.lot_no}>
              <option value={CUSTOMER_PORTAL_DEMO_DEPOSIT.lot_no}>{CUSTOMER_PORTAL_DEMO_DEPOSIT.lot_no}</option>
            </select>
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
          <button className="btn btn-secondary" onClick={() => { setForm(INITIAL_FORM); setSuccess(false); }} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="customer-withdrawal-submit-button" type="submit">{t('customer_withdrawal_submit')}</button>
        </div>
      </form>
    </section>
  );
}
