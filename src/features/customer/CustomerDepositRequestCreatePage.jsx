import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CustomerDepositLinesTable } from '../../components/customer/CustomerDepositLinesTable.jsx';
import { CsvImportExportToolbar } from '../../components/customer/CsvImportExportToolbar.jsx';
import { CUSTOMER_DEPOSIT_STATUSES } from '../../data/customerPortalDemoData.js';
import {
  createCustomerDepositRequest,
  getCustomerDepositRequest,
  listCustomerDepositRequestLines,
  submitCustomerDepositRequest,
  upsertCustomerDepositRequestLine,
} from '../../services/customerDepositRequestService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  downloadCustomerDepositLineTemplate,
  exportCustomerDepositLinesCsv,
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportRows,
} from '../../utils/customerDepositLineCsvUtils.js';
import { readCsvFile } from '../../utils/csvFileUtils.js';
import {
  createEmptyDepositLine,
  createInitialDepositLines,
  DEPOSIT_LINE_DEFAULT_COUNT,
  getFilledDepositLines,
} from '../../utils/customerDepositLineDefaults.js';
import {
  mapDepositHeaderForCopy,
  mapDepositLinesForCopy,
} from '../../utils/customerRequestCopyUtils.js';
import { CustomerRequestCustomerPicker } from '../../components/customer/CustomerRequestCustomerPicker.jsx';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const INITIAL_HEADER = {
  expected_arrival_date: '',
  note: '',
  contact_name: '',
  contact_phone: '',
};

function formatFileSize(size) {
  return `${(size / 1024).toFixed(1)} KB`;
}

export function CustomerDepositRequestCreatePage() {
  const t = useTranslation();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const { customerId, canWriteCustomerRequests, isRequestProxy } = useCustomerPortalProfile();
  const [proxyCustomerId, setProxyCustomerId] = useState('');
  const effectiveCustomerId = isRequestProxy ? proxyCustomerId : customerId;
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [lines, setLines] = useState(() => createInitialDepositLines());
  const [nextLineKey, setNextLineKey] = useState(DEPOSIT_LINE_DEFAULT_COUNT + 1);
  const [timelineStatus, setTimelineStatus] = useState('DRAFT');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [success, setSuccess] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copySourceNo, setCopySourceNo] = useState('');
  const [copyLoading, setCopyLoading] = useState(Boolean(copyFromId));
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    let active = true;

    if (!copyFromId) {
      setCopyLoading(false);
      setCopySourceNo('');
      setCopyError('');
      return undefined;
    }

    setCopyLoading(true);
    setCopyError('');

    (async () => {
      const headerResult = await getCustomerDepositRequest(copyFromId);
      if (!active) return;

      if (headerResult.error || !headerResult.data) {
        setCopyError(headerResult.error?.message ?? t('customer_request_copy_error'));
        setCopyLoading(false);
        return;
      }

      if (isRequestProxy) {
        setProxyCustomerId(headerResult.data.customer_id ?? '');
      }

      const sourceCustomerId = headerResult.data.customer_id;
      const [linesResult, catalogResult] = await Promise.all([
        listCustomerDepositRequestLines(copyFromId),
        listCustomerProducts({ customerId: sourceCustomerId, activeOnly: true }),
      ]);

      if (!active) return;

      if (linesResult.error) {
        setCopyError(linesResult.error.message ?? t('customer_request_copy_error'));
        setCopyLoading(false);
        return;
      }

      const catalogRows = catalogResult.data ?? [];
      setCatalogProducts(catalogRows);
      setCopySourceNo(headerResult.data.request_no ?? copyFromId);
      setHeader(mapDepositHeaderForCopy(headerResult.data));
      const copiedLines = mapDepositLinesForCopy(linesResult.data ?? [], catalogRows);
      setLines(copiedLines);
      setNextLineKey(copiedLines.length + 1);
      setCopyLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [copyFromId, isRequestProxy, t]);

  useEffect(() => {
    let active = true;
    if (!effectiveCustomerId || copyFromId) {
      if (!copyFromId) setCatalogProducts([]);
      return undefined;
    }

    listCustomerProducts({ customerId: effectiveCustomerId, activeOnly: true }).then((result) => {
      if (!active) return;
      setCatalogProducts(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [effectiveCustomerId, copyFromId]);

  if (copyLoading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-create-page">
        <LoadingState message={t('customer_request_copy_loading')} />
      </section>
    );
  }

  function updateHeaderField(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));
    setSuccess(null);
    setSubmitError('');
  }

  function addLine() {
    setLines((current) => [...current, createEmptyDepositLine(nextLineKey)]);
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
    setLines(createInitialDepositLines());
    setNextLineKey(DEPOSIT_LINE_DEFAULT_COUNT + 1);
    setTimelineStatus('DRAFT');
    setAttachments([]);
    setSuccess(null);
    setSubmitError('');
  }

  async function handleImportFile(file) {
    setImporting(true);
    setSubmitError('');
    setSuccess(null);

    try {
      const text = await readCsvFile(file);
      const { rows, errors: parseErrors } = parseCustomerDepositLineImportRows(text);

      if (parseErrors.length) {
        setSubmitError(parseErrors.join(' '));
        return;
      }

      const { lines: importedLines, errors } = mapImportedRowsToDepositLines(rows, catalogProducts, nextLineKey);
      if (errors.length) {
        setSubmitError(errors.join(' '));
        return;
      }

      if (!importedLines.length) {
        setSubmitError(t('csv_import_empty'));
        return;
      }

      setLines(importedLines);
      setNextLineKey(importedLines[importedLines.length - 1].key + 1);
    } catch (importError) {
      setSubmitError(importError.message ?? t('csv_import_error'));
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSuccess(null);

    if (!canWriteCustomerRequests) {
      setSubmitError(t('customer_portal_no_customer_scope'));
      return;
    }

    if (isRequestProxy && !proxyCustomerId) {
      setSubmitError(t('customer_request_proxy_customer_required'));
      return;
    }

    const activeLines = getFilledDepositLines(lines);
    if (!activeLines.length) {
      setSubmitError(t('customer_deposit_catalog_required'));
      return;
    }

    setSubmitting(true);

    const createResult = await createCustomerDepositRequest({
      expectedArrivalDate: header.expected_arrival_date,
      contactName: header.contact_name,
      contactPhone: header.contact_phone,
      note: header.note,
      customerId: isRequestProxy ? proxyCustomerId : null,
    });

    if (createResult.error) {
      setSubmitting(false);
      setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;

    for (let index = 0; index < activeLines.length; index += 1) {
      const line = activeLines[index];
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

    const submitResult = await submitCustomerDepositRequest(requestId);
    setSubmitting(false);

    if (submitResult.error) {
      setSubmitError(submitResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    setTimelineStatus(submitResult.data?.status ?? 'SUBMITTED_BY_CUSTOMER');
    setSuccess({
      requestNo: createResult.data?.request_no ?? requestId,
      lineCount: activeLines.length,
      status: submitResult.data?.status ?? 'SUBMITTED_BY_CUSTOMER',
    });
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-create-page">
      <PageHeader
        title={t('customer_deposit_create_title')}
        description={t('customer_deposit_description')}
        actions={(
          <Link className="btn btn-secondary" data-testid="customer-deposit-back-to-list" to="/customer/deposit-request">
            {t('customer_deposit_back_to_list')}
          </Link>
        )}
      />
      <CustomerPortalLiveBanner />

      <p className="form-helper" data-testid="customer-deposit-auto-number-hint">{t('customer_request_auto_number_hint')}</p>

      {copySourceNo ? (
        <div className="banner banner-info" data-testid="customer-deposit-copy-banner" role="status">
          {t('customer_request_copy_banner').replace('{sourceNo}', copySourceNo)}
        </div>
      ) : null}

      {copyError ? (
        <div className="banner banner-danger" role="alert">{copyError}</div>
      ) : null}

      <div className="customer-process-card">
        <h3>Deposit status timeline</h3>
        <CustomerProcessTimeline
          activeStatus={timelineStatus}
          statuses={CUSTOMER_DEPOSIT_STATUSES}
          testId="customer-deposit-status-timeline"
        />
      </div>

      {success ? (
        <div className="alert-success-panel" data-testid="customer-deposit-live-success-alert" role="status">
          {t('customer_deposit_live_success')} — {t('customer_request_copy_success_number')}: {success.requestNo} ({success.lineCount} {t('customer_deposit_line_count_label')})
          {' '}
          <Link to="/customer/deposit-request">{t('customer_deposit_back_to_list')}</Link>
        </div>
      ) : null}

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-deposit-request-form" onSubmit={handleSubmit}>
        {isRequestProxy ? (
          <CustomerRequestCustomerPicker
            onChange={setProxyCustomerId}
            testId="customer-deposit-proxy-customer-select"
            value={proxyCustomerId}
          />
        ) : null}

        <div className="customer-deposit-lines-panel">
          <div className="customer-deposit-lines-header">
            <h3>{t('customer_deposit_lines_title')}</h3>
            <div className="action-row">
              <CsvImportExportToolbar
                disabled={!canWriteCustomerRequests || importing}
                exportTestId="customer-deposit-export-button"
                importTestId="customer-deposit-import-input"
                onExport={() => exportCustomerDepositLinesCsv(lines)}
                onImportFile={handleImportFile}
                onTemplate={downloadCustomerDepositLineTemplate}
                templateTestId="customer-deposit-template-button"
              />
              <button className="btn btn-secondary" data-testid="customer-deposit-add-line-button" disabled={importing} onClick={addLine} type="button">
                {t('customer_deposit_add_line')}
              </button>
            </div>
          </div>

          <CustomerDepositLinesTable
            customerId={effectiveCustomerId}
            lines={lines}
            onChange={setLines}
            onRemoveLine={removeLine}
          />
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_expected_arrival_date')} <span className="field-required">*</span></span>
            <input className="form-control" data-testid="customer-deposit-expected-arrival-date" onChange={(e) => updateHeaderField('expected_arrival_date', e.target.value)} required type="date" value={header.expected_arrival_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_name')} <span className="field-required">*</span></span>
            <input className="form-control" data-testid="customer-deposit-contact-name" onChange={(e) => updateHeaderField('contact_name', e.target.value)} required value={header.contact_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_phone')} <span className="field-required">*</span></span>
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
          <Link className="btn btn-secondary" to="/customer/deposit-request">{t('close')}</Link>
          <button className="btn btn-secondary" onClick={resetForm} type="button">{t('filter_reset')}</button>
          <button className="btn btn-primary" data-testid="customer-deposit-submit-button" disabled={submitting || importing} type="submit">
            {submitting ? t('customer_deposit_submitting') : t('customer_deposit_submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
