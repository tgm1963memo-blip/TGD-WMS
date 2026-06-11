import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  requested_dispatch_date: '',
  product_code: '',
  product_name: '',
  lot_no: '',
  qty: '',
  uom: 'CTN',
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

  function handleSubmit(event) {
    event.preventDefault();
    setSuccess(true);
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-page">
      <PageHeader title={t('customer_withdrawal_title')} description={t('customer_withdrawal_description')} />

      <CustomerPortalDemoBanner />

      {success ? (
        <div className="alert-success-panel" data-testid="customer-withdrawal-demo-success-alert" role="status">
          {t('customer_withdrawal_demo_success')}
        </div>
      ) : null}

      <form className="form-card customer-portal-form" data-testid="customer-withdrawal-request-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_requested_dispatch_date')}</span>
            <input className="form-control" data-testid="customer-withdrawal-dispatch-date" onChange={(e) => updateField('requested_dispatch_date', e.target.value)} required type="date" value={form.requested_dispatch_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_product_code')}</span>
            <input className="form-control" data-testid="customer-withdrawal-product-code" onChange={(e) => updateField('product_code', e.target.value)} required value={form.product_code} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_product_name')}</span>
            <input className="form-control" data-testid="customer-withdrawal-product-name" onChange={(e) => updateField('product_name', e.target.value)} required value={form.product_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_lot_no')}</span>
            <input className="form-control" onChange={(e) => updateField('lot_no', e.target.value)} value={form.lot_no} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_qty')}</span>
            <input className="form-control" data-testid="customer-withdrawal-qty" min="1" onChange={(e) => updateField('qty', e.target.value)} required type="number" value={form.qty} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_uom')}</span>
            <select className="form-control" onChange={(e) => updateField('uom', e.target.value)} value={form.uom}>
              <option value="CTN">CTN</option>
              <option value="KG">KG</option>
              <option value="PLT">PLT</option>
            </select>
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
