import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_FORM = {
  expected_arrival_date: '',
  product_code: '',
  product_name: '',
  lot_no: '',
  qty: '',
  uom: 'CTN',
  pallet_count: '',
  temperature_type: 'FROZEN',
  note: '',
  contact_name: '',
  contact_phone: '',
};

export function CustomerDepositRequestPage() {
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
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-page">
      <PageHeader title={t('customer_deposit_title')} description={t('customer_deposit_description')} />

      <CustomerPortalDemoBanner />

      {success ? (
        <div className="alert-success-panel" data-testid="customer-deposit-demo-success-alert" role="status">
          {t('customer_deposit_demo_success')}
        </div>
      ) : null}

      <form className="form-card customer-portal-form" data-testid="customer-deposit-request-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_expected_arrival_date')}</span>
            <input className="form-control" data-testid="customer-deposit-expected-arrival-date" onChange={(e) => updateField('expected_arrival_date', e.target.value)} required type="date" value={form.expected_arrival_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_product_code')}</span>
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
            <span>{t('customer_field_qty')}</span>
            <input className="form-control" data-testid="customer-deposit-qty" min="1" onChange={(e) => updateField('qty', e.target.value)} required type="number" value={form.qty} />
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
            <span>{t('customer_field_pallet_count')}</span>
            <input className="form-control" min="0" onChange={(e) => updateField('pallet_count', e.target.value)} type="number" value={form.pallet_count} />
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
        <div className="action-row customer-portal-form-actions">
          <button className="btn btn-secondary" onClick={() => { setForm(INITIAL_FORM); setSuccess(false); }} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="customer-deposit-submit-button" type="submit">{t('customer_deposit_submit')}</button>
        </div>
      </form>
    </section>
  );
}
