import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CustomerDepositLinesTable } from '../../components/customer/CustomerDepositLinesTable.jsx';
import { ExcelImportExportToolbar } from '../../components/customer/ExcelImportExportToolbar.jsx';
import {
  CUSTOMER_DEPOSIT_STATUSES,
  getDepositStatusLabel,
} from '../../utils/customerDepositStatusLabels.js';
import {
  createCustomerDepositRequest,
  getCustomerDepositRequest,
  listCustomerDepositRequestLines,
  submitCustomerDepositRequest,
  upsertCustomerDepositRequestLine,
  updateCustomerDepositRequestDraft,
  deleteCustomerDepositRequestLine,
} from '../../services/customerDepositRequestService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  downloadCustomerDepositLineTemplate,
  exportCustomerDepositLinesExcel,
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportFile,
} from '../../utils/customerDepositLineExcelUtils.js';
import {
  createEmptyDepositLine,
  createInitialDepositLines,
  DEPOSIT_LINE_DEFAULT_COUNT,
  getFilledDepositLines,
} from '../../utils/customerDepositLineDefaults.js';
import {
  mapDepositHeaderForCopy,
  mapDepositLinesForCopy,
  resolveCatalogProductId,
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
  vehicle_registration: '',
  arrival_time: '',
};

function formatFileSize(size) {
  return `${(size / 1024).toFixed(1)} KB`;
}

export function CustomerDepositRequestCreatePage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const editId = searchParams.get('editId');
  const isEditMode = Boolean(editId);
  const { customerId, canWriteCustomerRequests, isRequestProxy, profile } = useCustomerPortalProfile();
  const [proxyCustomerId, setProxyCustomerId] = useState('');
  const effectiveCustomerId = isRequestProxy ? proxyCustomerId : customerId;
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [lines, setLines] = useState(() => createInitialDepositLines());
  const [nextLineKey, setNextLineKey] = useState(DEPOSIT_LINE_DEFAULT_COUNT + 1);
  const [editOriginalLineIds, setEditOriginalLineIds] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copySourceNo, setCopySourceNo] = useState('');
  const [copyLoading, setCopyLoading] = useState(Boolean(copyFromId) || Boolean(editId));
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
      try {
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
      } catch (err) {
        if (!active) return;
        setCopyError(err?.message ?? t('customer_request_copy_error'));
        setCopyLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [copyFromId, isRequestProxy, t]);

  useEffect(() => {
    let active = true;

    if (!editId) return undefined;

    setCopyLoading(true);
    setCopyError('');

    (async () => {
      try {
        const headerResult = await getCustomerDepositRequest(editId);
        if (!active) return;

        if (headerResult.error || !headerResult.data) {
          setCopyError(headerResult.error?.message ?? 'ไม่สามารถโหลดข้อมูลได้');
          setCopyLoading(false);
          return;
        }

        if (isRequestProxy) setProxyCustomerId(headerResult.data.customer_id ?? '');

        const sourceCustomerId = headerResult.data.customer_id;
        const [linesResult, catalogResult] = await Promise.all([
          listCustomerDepositRequestLines(editId),
          listCustomerProducts({ customerId: sourceCustomerId, activeOnly: true }),
        ]);

        if (!active) return;

        const catalogRows = catalogResult.data ?? [];
        const sourceLines = linesResult.data ?? [];
        setCatalogProducts(catalogRows);
        setHeader(mapDepositHeaderForCopy(headerResult.data));

        const editLines = sourceLines.map((line, index) => {
          const resolvedCatalogId = resolveCatalogProductId(line, catalogRows);
          const catalogProductId = resolvedCatalogId === '__manual__' ? '' : (resolvedCatalogId || '');
          const catalogMatch = catalogRows.find((p) => p.id === catalogProductId);
          const weightPerBox = String(line.weight_per_box ?? '');
          const weightFromMaster = Boolean(
            catalogMatch?.pack_weight_kg != null
            && String(catalogMatch.pack_weight_kg) === weightPerBox
            && weightPerBox !== '',
          );
          return {
            key: index + 1,
            lineId: line.id,
            catalog_product_id: catalogProductId,
            customer_product_code: line.customer_product_code ?? '',
            product_code: line.internal_product_code ?? '',
            product_name: line.product_name ?? '',
            weight_per_box: weightPerBox,
            weight_from_master: weightFromMaster,
            expected_boxes: String(line.expected_boxes ?? ''),
            expected_weight: String(line.expected_weight ?? ''),
            pack_entry_mode: 'BOXES',
            line_note: line.note ?? '',
            lot_no: line.lot_no ?? '',
            mfg_date: line.mfg_date ?? '',
            exp_date: line.exp_date ?? '',
            temperature_type: line.temperature_type ?? 'FROZEN',
          };
        });

        const padded = [...editLines];
        for (let i = editLines.length; i < Math.max(DEPOSIT_LINE_DEFAULT_COUNT, editLines.length); i += 1) {
          padded.push(createEmptyDepositLine(i + 1));
        }

        setEditOriginalLineIds(sourceLines.map((l) => l.id));
        setLines(padded);
        setNextLineKey(padded.length + 1);
        setCopyLoading(false);
      } catch (err) {
        if (!active) return;
        setCopyError(err?.message ?? 'ไม่สามารถโหลดข้อมูลได้');
        setCopyLoading(false);
      }
    })();

    return () => { active = false; };
  }, [editId, isRequestProxy]);

  // Auto-fill contact_name with logged-in user's name on new forms
  useEffect(() => {
    if (!profile || isEditMode || copyFromId) return;
    const name = profile.display_name
      || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      || profile.email
      || '';
    if (name) setHeader((h) => (h.contact_name ? h : { ...h, contact_name: name }));
  }, [profile, isEditMode, copyFromId]);

  useEffect(() => {
    let active = true;
    if (!effectiveCustomerId || copyFromId || editId) {
      if (!copyFromId && !editId) setCatalogProducts([]);
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
    setSubmitError('');
  }

  function addLine() {
    setLines((current) => [...current, createEmptyDepositLine(nextLineKey)]);
    setNextLineKey((current) => current + 1);
    setSubmitError('');
  }

  function removeLine(lineKey) {
    setLines((current) => {
      if (current.length <= 1) return current;
      return current.filter((line) => line.key !== lineKey);
    });
    setSubmitError('');
  }

  function handleAttachments(event) {
    const selected = Array.from(event.target.files ?? []);
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    setAttachmentError(oversized ? t('customer_deposit_attachment_size_error').replace('{filename}', oversized.name) : '');
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
    setAttachments([]);
    setSubmitError('');
  }

  async function handleImportFile(file) {
    setImporting(true);
    setSubmitError('');

    try {
      const { rows, errors: parseErrors } = await parseCustomerDepositLineImportFile(file);

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
        setSubmitError(t('excel_import_empty'));
        return;
      }

      setLines(importedLines);
      setNextLineKey(importedLines[importedLines.length - 1].key + 1);
    } catch (importError) {
      setSubmitError(importError.message ?? t('excel_import_error'));
    } finally {
      setImporting(false);
    }
  }

  async function saveFormData(shouldSubmit) {
    setSubmitError('');

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
      setSubmitError(t('customer_deposit_pack_required'));
      return;
    }

    setSubmitting(true);

    let requestId;

    if (isEditMode) {
      const updateResult = await updateCustomerDepositRequestDraft(editId, {
        expectedArrivalDate: header.expected_arrival_date,
        contactName: header.contact_name,
        contactPhone: header.contact_phone,
        note: header.note,
        vehicleRegistration: header.vehicle_registration,
        arrivalTime: header.arrival_time,
      });

      if (updateResult.error) {
        setSubmitting(false);
        setSubmitError(updateResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      requestId = editId;
    } else {
      const createResult = await createCustomerDepositRequest({
        expectedArrivalDate: header.expected_arrival_date,
        contactName: header.contact_name,
        contactPhone: header.contact_phone,
        note: header.note,
        vehicleRegistration: header.vehicle_registration,
        arrivalTime: header.arrival_time,
        customerId: isRequestProxy ? proxyCustomerId : null,
      });

      if (createResult.error) {
        setSubmitting(false);
        setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      requestId = createResult.data?.id;
    }

    if (isEditMode) {
      const activeLineIds = new Set(activeLines.map((l) => l.lineId).filter(Boolean));
      const toDelete = editOriginalLineIds.filter((id) => !activeLineIds.has(id));
      for (const deletedId of toDelete) {
        await deleteCustomerDepositRequestLine(editId, deletedId);
      }
    }

    for (let index = 0; index < activeLines.length; index += 1) {
      const line = activeLines[index];
      const lineResult = await upsertCustomerDepositRequestLine(requestId, {
        lineId: line.lineId ?? null,
        lineNo: index + 1,
        customerProductCode: line.customer_product_code,
        internalProductCode: line.product_code,
        productId: null,
        productName: line.product_name,
        expectedQty: line.expected_boxes,
        expectedBoxes: line.expected_boxes,
        expectedWeight: line.expected_weight,
        weightPerBox: line.weight_per_box,
        temperatureType: line.temperature_type,
        lotNo: line.lot_no || null,
        mfgDate: line.mfg_date || null,
        expDate: line.exp_date || null,
        note: line.line_note,
      });

      if (lineResult.error) {
        setSubmitting(false);
        setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      if (lineResult.data && lineResult.data.id && !line.lineId) {
        line.lineId = lineResult.data.id;
        setLines((current) => current.map((l) => (l.key === line.key ? { ...l, lineId: lineResult.data.id } : l)));
        setEditOriginalLineIds((current) => {
          if (!current.includes(lineResult.data.id)) return [...current, lineResult.data.id];
          return current;
        });
      }
    }

    if (!shouldSubmit) {
      setSubmitting(false);
      navigate(`/customer/deposit-request/${requestId}`);
      return;
    }

    const submitResult = await submitCustomerDepositRequest(requestId);
    setSubmitting(false);

    if (submitResult.error) {
      setSubmitError(submitResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    setSubmitted(true);
    navigate('/customer/deposit-request');
  }

  async function handleSaveDraft(event) {
    event.preventDefault();
    await saveFormData(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveFormData(true);
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-create-page">
      <PageHeader
        title={isEditMode ? 'แก้ไขร่างใบแจ้งฝาก' : t('customer_deposit_create_title')}
        description={isEditMode ? undefined : t('customer_deposit_description')}
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
        <h3>{t('customer_deposit_status_timeline_title')}</h3>
        <CustomerProcessTimeline
          activeStatus="DRAFT"
          getStatusLabel={(status) => getDepositStatusLabel(status, t)}
          statuses={CUSTOMER_DEPOSIT_STATUSES}
          testId="customer-deposit-status-timeline"
        />
      </div>

      {submitted ? (
        <div
          data-testid="customer-deposit-live-success-alert"
          role="alert"
          className="banner banner-success"
          style={{ margin: '12px 0' }}
        >
          {t('customer_deposit_submit_success')}
          {' — '}
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
              <ExcelImportExportToolbar
                disabled={!canWriteCustomerRequests || importing}
                exportTestId="customer-deposit-export-button"
                importTestId="customer-deposit-import-input"
                onExport={() => exportCustomerDepositLinesExcel(lines)}
                onImportFile={handleImportFile}
                onTemplate={() => downloadCustomerDepositLineTemplate(catalogProducts)}
                templateTestId="customer-deposit-template-button"
              />
              <button className="btn btn-secondary" data-testid="customer-deposit-add-line-button" disabled={importing} onClick={addLine} type="button">
                {t('customer_deposit_add_line')}
              </button>
            </div>
          </div>

          <CustomerDepositLinesTable
            catalogProducts={catalogProducts}
            lines={lines}
            onChange={setLines}
            onRemoveLine={removeLine}
          />
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_expected_arrival_date')} <span className="field-required">*</span></span>
            <input className="form-control" data-testid="customer-deposit-expected-arrival-date" min={new Date().toISOString().split('T')[0]} onChange={(e) => updateHeaderField('expected_arrival_date', e.target.value)} required type="date" value={header.expected_arrival_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_name')} <span className="field-required">*</span></span>
            <input className="form-control" data-testid="customer-deposit-contact-name" onChange={(e) => updateHeaderField('contact_name', e.target.value)} required value={header.contact_name} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_contact_phone')} <span className="field-required">*</span></span>
            <input className="form-control" data-testid="customer-deposit-contact-phone" onChange={(e) => updateHeaderField('contact_phone', e.target.value)} required value={header.contact_phone} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_vehicle_registration')}</span>
            <input className="form-control" data-testid="customer-deposit-vehicle-registration" onChange={(e) => updateHeaderField('vehicle_registration', e.target.value)} value={header.vehicle_registration} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_arrival_time')}</span>
            <input className="form-control" data-testid="customer-deposit-arrival-time" onChange={(e) => updateHeaderField('arrival_time', e.target.value)} type="time" value={header.arrival_time} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateHeaderField('note', e.target.value)} rows={3} value={header.note} />
          </label>
        </div>

        <div className="customer-attachment-panel">
          <label className="form-field">
            <span>{t('customer_deposit_attachments_title')}</span>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
              data-testid="customer-deposit-attachment-input"
              multiple
              onChange={handleAttachments}
              type="file"
            />
          </label>
          <p className="form-helper" data-testid="customer-deposit-attachment-demo-note">
            {t('customer_deposit_attachments_deferred_note')}
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
                  {t('customer_deposit_attachment_remove')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="action-row customer-portal-form-actions">
          <Link className="btn btn-secondary" to="/customer/deposit-request">{t('close')}</Link>
          <button className="btn btn-secondary" data-testid="customer-deposit-save-draft-button" disabled={submitting || importing} onClick={handleSaveDraft} type="button">
            {submitting ? t('customer_deposit_submitting') : 'บันทึกร่าง'}
          </button>
          <button className="btn btn-primary" data-testid="customer-deposit-submit-button" disabled={submitting || importing} type="submit">
            {submitting ? t('customer_deposit_submitting') : 'ส่งยืนยันการแจ้งฝาก'}
          </button>
        </div>
      </form>
    </section>
  );
}
