import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerProductPicker } from '../../components/customer/CustomerProductPicker.jsx';
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

const INITIAL_HEADER = {
  expected_arrival_date: '',
  note: '',
  contact_name: '',
  contact_phone: '',
};

function createEmptyLine(lineKey = 1) {
  return {
    key: lineKey,
    catalog_product_id: '',
    customer_product_code: '',
    product_code: '',
    product_name: '',
    lot_no: '',
    expected_qty: '',
    expected_boxes: '',
    expected_weight: '',
    temperature_type: 'FROZEN',
  };
}

function formatFileSize(size) {
  return `${(size / 1024).toFixed(1)} KB`;
}

function isCatalogLineSelected(line) {
  return Boolean(line.catalog_product_id && line.catalog_product_id !== '__manual__');
}

export function CustomerDepositRequestPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests } = useCustomerPortalProfile();
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [lines, setLines] = useState([createEmptyLine(1)]);
  const [nextLineKey, setNextLineKey] = useState(2);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [success, setSuccess] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateHeaderField(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));
    setSuccess(null);
    setSubmitError('');
  }

  function updateLineField(lineKey, field, value) {
    setLines((current) => current.map((line) => (
      line.key === lineKey ? { ...line, [field]: value } : line
    )));
    setSuccess(null);
    setSubmitError('');
  }

  function updateLineFromCatalog(lineKey, selection) {
    setLines((current) => current.map((line) => (
      line.key === lineKey
        ? {
          ...line,
          catalog_product_id: selection.catalogProductId,
          customer_product_code: selection.customerProductCode,
          product_code: selection.internalProductCode,
          product_name: selection.productName,
          temperature_type: selection.temperatureType || line.temperature_type,
        }
        : line
    )));
    setSuccess(null);
    setSubmitError('');
  }

  function addLine() {
    setLines((current) => [...current, createEmptyLine(nextLineKey)]);
    setNextLineKey((current) => current + 1);
    setSuccess(null);
    setSubmitError('');
  }

  function removeLine(lineKey) {
    setLines((current) => {
      if (current.length <= 1) return current;
      return current.filter((line) => line.key !== lineKey);
    });
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

  function resetForm() {
    setHeader(INITIAL_HEADER);
    setLines([createEmptyLine(1)]);
    setNextLineKey(2);
    setAttachments([]);
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

    const invalidLine = lines.find((line) => !isCatalogLineSelected(line));
    if (invalidLine) {
      setSubmitError(t('customer_deposit_catalog_required'));
      return;
    }

    setSubmitting(true);

    const createResult = await createCustomerDepositRequest({
      expectedArrivalDate: header.expected_arrival_date,
      contactName: header.contact_name,
      contactPhone: header.contact_phone,
      note: header.note,
    });

    if (createResult.error) {
      setSubmitting(false);
      setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineResult = await upsertCustomerDepositRequestLine(requestId, {
        lineNo: index + 1,
        customerProductCode: line.customer_product_code,
        internalProductCode: line.product_code,
        productName: line.product_name,
        lotNo: line.lot_no,
        expectedQty: line.expected_qty,
        expectedBoxes: line.expected_boxes,
        expectedWeight: line.expected_weight,
        temperatureType: line.temperature_type,
        note: header.note,
      });

      if (lineResult.error) {
        setSubmitting(false);
        setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
        return;
      }
    }

    setSubmitting(false);
    setSuccess({
      requestNo: createResult.data?.request_no ?? requestId,
      lineCount: lines.length,
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
          {t('customer_deposit_live_success')} ({success.requestNo}, {success.lineCount} {t('customer_deposit_line_count_label')})
        </div>
      ) : null}

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-deposit-request-form" onSubmit={handleSubmit}>
        <div className="customer-deposit-lines-panel">
          <div className="customer-deposit-lines-header">
            <h3>{t('customer_deposit_lines_title')}</h3>
            <button className="btn btn-secondary" data-testid="customer-deposit-add-line-button" onClick={addLine} type="button">
              {t('customer_deposit_add_line')}
            </button>
          </div>

          {lines.map((line, index) => {
            const catalogLocked = isCatalogLineSelected(line);
            const lineTestId = index === 0 ? 'customer-deposit-line-0' : `customer-deposit-line-${line.key}`;

            return (
              <div className="customer-deposit-line-card" data-testid={lineTestId} key={line.key}>
                <div className="customer-deposit-line-card-header">
                    <strong>{t('customer_deposit_line_prefix')} {index + 1}</strong>
                  {lines.length > 1 ? (
                    <button
                      className="btn btn-secondary"
                      data-testid={`${lineTestId}-remove-button`}
                      onClick={() => removeLine(line.key)}
                      type="button"
                    >
                      {t('customer_deposit_remove_line')}
                    </button>
                  ) : null}
                </div>

                <div className="form-grid">
                  <div className="form-field form-field-span-2">
                    <CustomerProductPicker
                      addProductsHint={t('catalog_add_products_first_hint')}
                      addProductsLinkLabel={t('catalog_create')}
                      catalogOnly
                      catalogOnlyEmptyLabel={t('catalog_empty')}
                      customerId={customerId}
                      onChange={(selection) => updateLineFromCatalog(line.key, selection)}
                      testId={index === 0 ? 'customer-deposit-product-picker' : `${lineTestId}-product-picker`}
                      value={{
                        catalogProductId: line.catalog_product_id,
                        customerProductCode: line.customer_product_code,
                        internalProductCode: line.product_code,
                        productName: line.product_name,
                        temperatureType: line.temperature_type,
                      }}
                    />
                  </div>
                  <label className="form-field">
                    <span>Customer product code</span>
                    <input
                      className="form-control"
                      data-testid={index === 0 ? 'customer-product-code-input' : `${lineTestId}-customer-product-code`}
                      disabled={catalogLocked}
                      onChange={(e) => updateLineField(line.key, 'customer_product_code', e.target.value)}
                      required
                      value={line.customer_product_code}
                    />
                  </label>
                  <label className="form-field">
                    <span>Internal product code</span>
                    <input
                      className="form-control"
                      data-testid={index === 0 ? 'customer-deposit-product-code' : `${lineTestId}-product-code`}
                      disabled={catalogLocked}
                      onChange={(e) => updateLineField(line.key, 'product_code', e.target.value)}
                      required={catalogLocked}
                      value={line.product_code}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t('customer_field_product_name')}</span>
                    <input
                      className="form-control"
                      data-testid={index === 0 ? 'customer-deposit-product-name' : `${lineTestId}-product-name`}
                      disabled={catalogLocked}
                      onChange={(e) => updateLineField(line.key, 'product_name', e.target.value)}
                      required
                      value={line.product_name}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t('customer_field_lot_no')}</span>
                    <input className="form-control" onChange={(e) => updateLineField(line.key, 'lot_no', e.target.value)} value={line.lot_no} />
                  </label>
                  <label className="form-field">
                    <span>Expected quantity</span>
                    <input
                      className="form-control"
                      data-testid={index === 0 ? 'customer-deposit-qty' : `${lineTestId}-qty`}
                      min="1"
                      onChange={(e) => updateLineField(line.key, 'expected_qty', e.target.value)}
                      required
                      type="number"
                      value={line.expected_qty}
                    />
                  </label>
                  <label className="form-field">
                    <span>Expected boxes</span>
                    <input className="form-control" min="0" onChange={(e) => updateLineField(line.key, 'expected_boxes', e.target.value)} type="number" value={line.expected_boxes} />
                  </label>
                  <label className="form-field">
                    <span>Expected weight (kg)</span>
                    <input className="form-control" min="0" onChange={(e) => updateLineField(line.key, 'expected_weight', e.target.value)} step="0.01" type="number" value={line.expected_weight} />
                  </label>
                  <label className="form-field">
                    <span>{t('customer_field_temperature_type')}</span>
                    <select className="form-control" onChange={(e) => updateLineField(line.key, 'temperature_type', e.target.value)} value={line.temperature_type}>
                      <option value="FROZEN">FROZEN</option>
                      <option value="CHILLED">CHILLED</option>
                      <option value="AMBIENT">AMBIENT</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_expected_arrival_date')}</span>
            <input className="form-control" data-testid="customer-deposit-expected-arrival-date" onChange={(e) => updateHeaderField('expected_arrival_date', e.target.value)} required type="date" value={header.expected_arrival_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_name')}</span>
            <input className="form-control" data-testid="customer-deposit-contact-name" onChange={(e) => updateHeaderField('contact_name', e.target.value)} required value={header.contact_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_phone')}</span>
            <input className="form-control" data-testid="customer-deposit-contact-phone" onChange={(e) => updateHeaderField('contact_phone', e.target.value)} required value={header.contact_phone} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateHeaderField('note', e.target.value)} rows={3} value={header.note} />
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
          <button className="btn btn-secondary" onClick={resetForm} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="customer-deposit-submit-button" disabled={submitting} type="submit">
            {submitting ? t('customer_deposit_submitting') : t('customer_deposit_submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
