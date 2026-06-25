import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CustomerWithdrawalLinesTable } from '../../components/customer/CustomerWithdrawalLinesTable.jsx';
import { CUSTOMER_WITHDRAWAL_STATUSES } from '../../data/customerPortalDemoData.js';
import {
  createCustomerWithdrawalRequest,
  getCustomerWithdrawalRequest,
  listCustomerWithdrawalRequestLines,
  upsertCustomerWithdrawalRequestLine,
  updateCustomerWithdrawalRequestDraft,
  deleteCustomerWithdrawalRequestLine,
  submitCustomerWithdrawalRequest,
} from '../../services/customerWithdrawalRequestService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  getDepositInventoryLines,
} from '../../services/customerDepositRequestService.js';
import {
  mapWithdrawalHeaderForCopy,
  mapWithdrawalLinesForCopy,
} from '../../utils/customerRequestCopyUtils.js';
import {
  createEmptyWithdrawalLine,
  createInitialWithdrawalLines,
  getFilledWithdrawalLines,
  WITHDRAWAL_LINE_DEFAULT_COUNT,
} from '../../utils/customerWithdrawalLineDefaults.js';
import { CustomerRequestCustomerPicker } from '../../components/customer/CustomerRequestCustomerPicker.jsx';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_HEADER = {
  requested_dispatch_date: '',
  delivery_type: 'PICKUP',
  pickup_contact: '',
  destination: '',
  note: '',
};

export function CustomerWithdrawalRequestCreatePage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const editId = searchParams.get('editId');
  const isEditMode = Boolean(editId);
  const { customerId, canWriteCustomerRequests, isRequestProxy } = useCustomerPortalProfile();
  const [proxyCustomerId, setProxyCustomerId] = useState('');
  const effectiveCustomerId = isRequestProxy ? proxyCustomerId : customerId;
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [lines, setLines] = useState(() => createInitialWithdrawalLines());
  const [nextLineKey, setNextLineKey] = useState(WITHDRAWAL_LINE_DEFAULT_COUNT + 1);
  const [editOriginalLineIds, setEditOriginalLineIds] = useState([]);
  const [depositOptions, setDepositOptions] = useState([]);
  const [depositLinesMap, setDepositLinesMap] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copySourceNo, setCopySourceNo] = useState('');
  const [copyLoading, setCopyLoading] = useState(Boolean(copyFromId) || Boolean(editId));
  const [copyError, setCopyError] = useState('');
  const [editStatus, setEditStatus] = useState(null);

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
        const headerResult = await getCustomerWithdrawalRequest(copyFromId);
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
          listCustomerWithdrawalRequestLines(copyFromId),
          listCustomerProducts({ customerId: sourceCustomerId, activeOnly: true }),
        ]);

        if (!active) return;

        if (linesResult.error) {
          setCopyError(linesResult.error.message ?? t('customer_request_copy_error'));
          setCopyLoading(false);
          return;
        }

        const copiedLines = mapWithdrawalLinesForCopy(linesResult.data ?? [], catalogResult.data ?? []);
        setCopySourceNo(headerResult.data.withdrawal_no ?? copyFromId);
        setHeader(mapWithdrawalHeaderForCopy(headerResult.data));
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
        const headerResult = await getCustomerWithdrawalRequest(editId);
        if (!active) return;

        if (headerResult.error || !headerResult.data) {
          setCopyError(headerResult.error?.message ?? 'ไม่สามารถโหลดข้อมูลได้');
          setCopyLoading(false);
          return;
        }

        if (isRequestProxy) setProxyCustomerId(headerResult.data.customer_id ?? '');

        setEditStatus(headerResult.data.status ?? null);

        const linesResult = await listCustomerWithdrawalRequestLines(editId);
        if (!active) return;

        const sourceLines = linesResult.data ?? [];
        setHeader(mapWithdrawalHeaderForCopy(headerResult.data));

        const editLines = sourceLines.map((line, index) => ({
          key: index + 1,
          lineId: line.id,
          catalog_product_id: line.catalog_product_id ?? '',
          customer_product_code: line.customer_product_code ?? '',
          product_code: line.internal_product_code ?? '',
          product_id: line.product_id ?? '',
          product_name: line.product_name ?? '',
          source_deposit_request_id: line.source_customer_deposit_request_id ?? '',
          lot_no: line.source_lot_no ?? line.lot_no ?? '',
          mfg_date: line.mfg_date ?? '',
          exp_date: line.exp_date ?? '',
          requested_qty: String(line.requested_qty ?? ''),
          requested_boxes: String(line.requested_boxes ?? ''),
          requested_weight: String(line.requested_weight ?? ''),
          picking_rule: line.picking_rule ?? 'FEFO',
        }));

        const padded = [...editLines];
        for (let i = editLines.length; i < Math.max(WITHDRAWAL_LINE_DEFAULT_COUNT, editLines.length); i += 1) {
          padded.push(createEmptyWithdrawalLine(i + 1));
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

  useEffect(() => {
    let active = true;
    if (!effectiveCustomerId) {
      setDepositOptions([]);
      setDepositLinesMap({});
      return undefined;
    }

    getDepositInventoryLines({ customerId: effectiveCustomerId }).then((result) => {
      if (!active) return;
      const allLines = result.data ?? [];
      
      const linesByDeposit = {};
      const depositMap = {};

      allLines.forEach((l) => {
        if (!linesByDeposit[l.deposit_request_id]) linesByDeposit[l.deposit_request_id] = [];
        linesByDeposit[l.deposit_request_id].push(l);

        if (l.request) {
          depositMap[l.deposit_request_id] = {
            id: l.deposit_request_id,
            label: `${l.request.request_no} (${l.request.expected_arrival_date ?? '-'})`,
          };
        }
      });

      setDepositOptions(Object.values(depositMap));
      setDepositLinesMap(linesByDeposit);
    });

    return () => { active = false; };
  }, [effectiveCustomerId]);

  if (copyLoading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-create-page">
        <LoadingState message={t('customer_request_copy_loading')} />
      </section>
    );
  }

  function updateHeaderField(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));

    setSubmitError('');
  }

  function addLine() {
    setLines((current) => [...current, createEmptyWithdrawalLine(nextLineKey)]);
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

  function normalizeLotNo(rawLot) {
    return rawLot === '__null_lot__' ? '' : (rawLot || null);
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

    if (isEditMode && editStatus && editStatus !== 'WITHDRAWAL_DRAFT') {
      setSubmitError('คำขอนี้ไม่อยู่ในสถานะร่าง ไม่สามารถแก้ไขหรือส่งได้ (สถานะ: ' + editStatus + ')');
      return;
    }

    const activeLines = getFilledWithdrawalLines(lines);
    if (!activeLines.length) {
      setSubmitError(t('customer_deposit_catalog_required'));
      return;
    }

    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const lot = normalizeLotNo(line.lot_no);
      if (!lot && !line.source_deposit_request_id) {
        setSubmitError(`รายการที่ ${i + 1}: ถ้าไม่ระบุ LOT กรุณาเลือกแหล่งที่มา (ใบฝาก)`);
        return;
      }
    }

    setSubmitting(true);

    let requestId;

    if (isEditMode) {
      const updateResult = await updateCustomerWithdrawalRequestDraft(editId, {
        requestedDispatchDate: header.requested_dispatch_date,
        deliveryType: header.delivery_type,
        pickupContact: header.pickup_contact,
        destination: header.destination,
        note: header.note,
      });

      if (updateResult.error) {
        setSubmitting(false);
        setSubmitError(updateResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      requestId = editId;
    } else {
      const createResult = await createCustomerWithdrawalRequest({
        requestedDispatchDate: header.requested_dispatch_date,
        deliveryType: header.delivery_type,
        pickupContact: header.pickup_contact,
        destination: header.destination,
        note: header.note,
        customerId: isRequestProxy ? proxyCustomerId : null,
      });

      if (createResult.error) {
        setSubmitting(false);
        setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      requestId = createResult.data?.id;

      if (!requestId) {
        setSubmitting(false);
        setSubmitError('ไม่สามารถสร้างคำขอได้ กรุณาลองใหม่');
        return;
      }
    }

    for (let index = 0; index < activeLines.length; index += 1) {
      const line = activeLines[index];
      const normalizedLot = normalizeLotNo(line.lot_no);
      const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
        lineId: line.lineId ?? null,
        lineNo: index + 1,
        sourceDepositRequestId: line.source_deposit_request_id || null,
        sourceLotNo: normalizedLot,
        customerProductCode: line.customer_product_code,
        internalProductCode: line.product_code,
        productName: line.product_name,
        lotNo: normalizedLot,
        mfgDate: line.mfg_date || null,
        expDate: line.exp_date || null,
        requestedQty: line.requested_qty,
        requestedBoxes: line.requested_boxes,
        requestedWeight: line.requested_weight,
        pickingRule: line.picking_rule,
        note: header.note,
      });

      if (lineResult.error) {
        setSubmitting(false);
        setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
        return;
      }
    }

    if (isEditMode) {
      const activeLineIds = new Set(activeLines.map((l) => l.lineId).filter(Boolean));
      const toDelete = editOriginalLineIds.filter((id) => !activeLineIds.has(id));
      for (const deletedId of toDelete) {
        await deleteCustomerWithdrawalRequestLine(requestId, deletedId);
      }
    }

    if (!shouldSubmit) {
      setSubmitting(false);
      navigate(`/customer/withdrawal-request/${requestId}`);
      return;
    }

    const submitResult = await submitCustomerWithdrawalRequest(requestId);
    setSubmitting(false);

    if (submitResult.error) {
      setSubmitError(submitResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    navigate('/customer/withdrawal-request');
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
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-create-page">
      <PageHeader
        title={isEditMode ? 'แก้ไขร่างใบแจ้งเบิก' : t('customer_withdrawal_create_title')}
        description={isEditMode ? undefined : t('customer_withdrawal_description')}
        actions={(
          <Link className="btn btn-secondary" data-testid="customer-withdrawal-back-to-list" to="/customer/withdrawal-request">
            {t('customer_withdrawal_back_to_list')}
          </Link>
        )}
      />
      <CustomerPortalLiveBanner />

      <p className="form-helper" data-testid="customer-withdrawal-auto-number-hint">{t('customer_request_auto_number_hint')}</p>

      {copySourceNo ? (
        <div className="banner banner-info" data-testid="customer-withdrawal-copy-banner" role="status">
          {t('customer_request_copy_banner').replace('{sourceNo}', copySourceNo)}
        </div>
      ) : null}

      {copyError ? (
        <div className="banner banner-danger" role="alert">{copyError}</div>
      ) : null}

      <div className="customer-process-card">
        <h3>Withdrawal status timeline</h3>
        <CustomerProcessTimeline statuses={CUSTOMER_WITHDRAWAL_STATUSES} testId="customer-withdrawal-status-timeline" />
      </div>

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-withdrawal-request-form" onSubmit={handleSubmit}>
        {isRequestProxy ? (
          <CustomerRequestCustomerPicker
            onChange={setProxyCustomerId}
            testId="customer-withdrawal-proxy-customer-select"
            value={proxyCustomerId}
          />
        ) : null}

        <div className="customer-deposit-lines-panel">
          <div className="customer-deposit-lines-header">
            <h3>{t('customer_withdrawal_lines_title')}</h3>
            <div className="action-row">
              <button className="btn btn-secondary" data-testid="customer-withdrawal-add-line-button" onClick={addLine} type="button">
                {t('customer_deposit_add_line')}
              </button>
            </div>
          </div>

          <CustomerWithdrawalLinesTable
            customerId={effectiveCustomerId}
            depositOptions={depositOptions}
            depositLinesMap={depositLinesMap}
            lines={lines}
            onChange={setLines}
            onRemoveLine={removeLine}
          />
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_requested_dispatch_date')}</span>
            <input className="form-control" data-testid="customer-withdrawal-dispatch-date" min={new Date().toISOString().split('T')[0]} onChange={(e) => updateHeaderField('requested_dispatch_date', e.target.value)} required type="date" value={header.requested_dispatch_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_pickup_contact')}</span>
            <input className="form-control" data-testid="customer-withdrawal-pickup-contact" onChange={(e) => updateHeaderField('pickup_contact', e.target.value)} required value={header.pickup_contact} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_destination')}</span>
            <input className="form-control" onChange={(e) => updateHeaderField('destination', e.target.value)} value={header.destination} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateHeaderField('note', e.target.value)} rows={3} value={header.note} />
          </label>
        </div>
        <div className="action-row customer-portal-form-actions">
          <Link className="btn btn-secondary" to="/customer/withdrawal-request">{t('close')}</Link>
          <button className="btn btn-secondary" data-testid="customer-withdrawal-save-draft-button" disabled={submitting} onClick={handleSaveDraft} type="button">
            {submitting ? t('customer_withdrawal_submitting') : 'บันทึกร่าง'}
          </button>
          <button className="btn btn-primary" data-testid="customer-withdrawal-submit-button" disabled={submitting} type="submit">
            {submitting ? t('customer_withdrawal_submitting') : 'ส่งยืนยันการแจ้งเบิก'}
          </button>
        </div>
      </form>
    </section>
  );
}
