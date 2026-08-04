import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CustomerWithdrawalLinesTable } from '../../components/customer/CustomerWithdrawalLinesTable.jsx';
import { DateInputDMY } from '../../components/common/DateInputDMY.jsx';
import { ExcelImportExportToolbar } from '../../components/customer/ExcelImportExportToolbar.jsx';
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
  getIncompleteWithdrawalLines,
  getMatchedDepositLine,
  getWithdrawalBalanceInfo,
  WITHDRAWAL_LINE_DEFAULT_COUNT,
} from '../../utils/customerWithdrawalLineDefaults.js';
import {
  downloadCustomerWithdrawalLineTemplate,
  exportCustomerWithdrawalLinesExcel,
  mapImportedRowsToWithdrawalLines,
  parseCustomerWithdrawalLineImportFile,
} from '../../utils/customerWithdrawalLineExcelUtils.js';
import { CustomerRequestCustomerPicker } from '../../components/customer/CustomerRequestCustomerPicker.jsx';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

// Bounds a manually-typed dispatch date to a plausible near-term window — catches
// a mistyped year (e.g. 2027 instead of 2026) before it saves, since a real
// dispatch is never planned this far out. See DateInputDMY's BUDDHIST_ERA_OFFSET
// comment for the sibling class of year-typo it already guards against.
const MAX_DISPATCH_DATE_DAYS_AHEAD = 180;
function maxDispatchDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + MAX_DISPATCH_DATE_DAYS_AHEAD);
  return d.toISOString().split('T')[0];
}

const INITIAL_HEADER = {
  requested_dispatch_date: '',
  delivery_type: 'PICKUP',
  pickup_contact: '',
  destination: '',
  vehicle_registration: '',
  note: '',
  requires_r3_document: false,
};

export function CustomerWithdrawalRequestCreatePage() {
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
  const [lines, setLines] = useState(() => createInitialWithdrawalLines());
  const [nextLineKey, setNextLineKey] = useState(WITHDRAWAL_LINE_DEFAULT_COUNT + 1);
  const [editOriginalLineIds, setEditOriginalLineIds] = useState([]);
  const [depositLinesMap, setDepositLinesMap] = useState({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
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

        const sourceCustomerId = headerResult.data.customer_id;
        const [linesResult, catalogResult] = await Promise.all([
          listCustomerWithdrawalRequestLines(editId),
          listCustomerProducts({ customerId: sourceCustomerId, activeOnly: true }),
        ]);
        if (!active) return;

        const sourceLines = linesResult.data ?? [];
        const catalogByCode = {};
        (catalogResult.data ?? []).forEach((p) => {
          if (p.customer_product_code) catalogByCode[p.customer_product_code] = p.id;
        });

        setHeader(mapWithdrawalHeaderForCopy(headerResult.data));

        const editLines = sourceLines.map((line, index) => ({
          key: index + 1,
          lineId: line.id,
          catalog_product_id: catalogByCode[line.customer_product_code] ?? '',
          customer_product_code: line.customer_product_code ?? '',
          product_code: line.internal_product_code ?? '',
          product_id: line.product_id ?? '',
          product_name: line.product_name ?? '',
          source_deposit_request_id: line.source_customer_deposit_request_id ?? '',
          // A LOT can span more than one tracking code (see the several
          // "lot fanout" fixes elsewhere in this codebase) — when the line
          // already has a specific tracking_code (e.g. from FEFO
          // auto-allocation), re-loading it as a bare LOT identifier can
          // resolve to a *different* batch under the same lot number than
          // the one actually allocated. Prefer the precise identifier.
          identifier_type: line.tracking_code ? 'TRACKING_CODE' : 'LOT',
          identifier_value: line.tracking_code || line.source_lot_no || line.lot_no || '',
          lot_no: line.source_lot_no ?? line.lot_no ?? '',
          mfg_date: line.mfg_date ?? '',
          exp_date: line.exp_date ?? '',
          withdrawal_qty_mode: line.pack_entry_mode ?? (String(line.requested_boxes ?? '').trim() !== '' ? 'BOXES' : 'WEIGHT'),
          requested_qty: String(line.requested_qty ?? ''),
          requested_boxes: String(line.requested_boxes ?? ''),
          requested_weight: String(line.requested_weight ?? ''),
          picking_rule: line.picking_rule ?? 'FEFO',
          note: line.note ?? '',
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
      setDepositLinesMap({});
      return undefined;
    }

    getDepositInventoryLines({ customerId: effectiveCustomerId, excludeWithdrawalRequestId: editId || undefined }).then((result) => {
      if (!active) return;
      if (result.error) {
        setSubmitError(result.error.message ?? 'โหลดรายการสินค้าคงเหลือไม่สำเร็จ กรุณาลองรีเฟรชหน้าใหม่');
        return;
      }
      const allLines = result.data ?? [];

      const linesByDeposit = {};
      allLines.forEach((l) => {
        if (!linesByDeposit[l.deposit_request_id]) linesByDeposit[l.deposit_request_id] = [];
        linesByDeposit[l.deposit_request_id].push(l);
      });

      setDepositLinesMap(linesByDeposit);
    });

    return () => { active = false; };
    // editId must stay in deps: after a first save, handleSubmit navigates
    // to ?editId=<newId> with { replace: true } on this same mounted page
    // (no remount) — without refetching here, the draft's own just-saved
    // lines keep counting as claims against themselves (excludeWithdrawalRequestId
    // stays stale at its pre-save value), showing "เกินยอดคงเหลือ" on stock
    // the customer actually still has.
  }, [effectiveCustomerId, editId]);

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

    return () => { active = false; };
  }, [effectiveCustomerId, copyFromId, editId]);

  // Auto-fill pickup_contact with logged-in user's name on new forms
  useEffect(() => {
    if (!profile || isEditMode || copyFromId) return;
    const name = profile.display_name
      || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      || profile.email
      || '';
    if (name) setHeader((h) => (h.pickup_contact ? h : { ...h, pickup_contact: name }));
  }, [profile, isEditMode, copyFromId]);

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

  async function handleImportFile(file) {
    setImporting(true);
    setSubmitError('');
    setImportNotice('');

    try {
      const { rows, errors: parseErrors } = await parseCustomerWithdrawalLineImportFile(file);

      if (parseErrors.length) {
        setSubmitError(parseErrors.join(' '));
        return;
      }

      const allDepositLines = Object.values(depositLinesMap).flat();
      const { lines: importedLines, errors: rowErrors } = mapImportedRowsToWithdrawalLines(rows, catalogProducts, allDepositLines, nextLineKey);

      if (!importedLines.length) {
        setSubmitError(rowErrors.length ? rowErrors.join(' ') : t('excel_import_empty'));
        return;
      }

      setLines(importedLines);
      setNextLineKey(importedLines[importedLines.length - 1].key + 1);
      if (rowErrors.length) {
        setImportNotice(`${importedLines.length} ${t('excel_import_success')} (${rowErrors.length} skipped) — ${rowErrors.join(' ')}`);
      }
    } catch (importError) {
      setSubmitError(importError.message ?? t('excel_import_error'));
    } finally {
      setImporting(false);
    }
  }

  function normalizeLotNo(rawLot) {
    return rawLot === '__null_lot__' ? '' : (rawLot || null);
  }

  // activeLines (the filtered, product+qty-only subset) doesn't share indices
  // with the table's own # column once any row is skipped — resolve the row
  // number a user actually sees on screen by the line's stable key instead of
  // reusing a loop index into a filtered array.
  function displayRowNo(line) {
    const idx = lines.findIndex((l) => l.key === line.key);
    return idx === -1 ? '?' : idx + 1;
  }

  async function saveFormData(shouldSubmit) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError('');

    try {
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

      const incompleteLines = getIncompleteWithdrawalLines(lines);
      if (incompleteLines.length) {
        const rowNumbers = incompleteLines.map(({ index }) => index + 1).join(', ');
        setSubmitError(`กรุณากรอกจำนวนที่ต้องการเบิกให้ครบในแถวที่ ${rowNumbers} หรือเอาสินค้าในแถวนั้นออก ก่อนบันทึก`);
        return;
      }

      const activeLines = getFilledWithdrawalLines(lines);
      if (!activeLines.length) {
        setSubmitError(t('customer_deposit_catalog_required'));
        return;
      }

      const allDepositLines = Object.values(depositLinesMap).flat();

      for (let i = 0; i < activeLines.length; i++) {
        const line = activeLines[i];
        const lot = normalizeLotNo(line.lot_no);
        if (!lot && !line.source_deposit_request_id) {
          setSubmitError(`รายการที่ ${displayRowNo(line)}: ถ้าไม่สามารถระบุ LOT ที่ชัดเจนได้ กรุณาเลือกแหล่งที่มา (ใบฝาก)`);
          return;
        }

        const matchedDepositLine = getMatchedDepositLine(line, allDepositLines);
        const weightPerBox = matchedDepositLine?.weight_per_box ? Number(matchedDepositLine.weight_per_box) : null;
        if (!weightPerBox) {
          const boxesFilled = String(line.requested_boxes ?? '').trim() !== '';
          const weightFilled = String(line.requested_weight ?? '').trim() !== '';
          if (!boxesFilled || !weightFilled) {
            setSubmitError(`รายการที่ ${displayRowNo(line)}: ไม่ทราบน้ำหนักต่อกล่อง กรุณาระบุทั้งจำนวนกล่องและน้ำหนัก`);
            return;
          }
        }

        const { maxBoxBalance, maxWtBalance, exceedsBoxBalance, exceedsWtBalance } = getWithdrawalBalanceInfo(line, allDepositLines, activeLines);
        if (exceedsBoxBalance) {
          setSubmitError(`รายการที่ ${displayRowNo(line)}: จำนวนกล่องที่เบิกเกินยอดคงเหลือ (มี ${maxBoxBalance} กล่อง)`);
          return;
        }
        if (exceedsWtBalance) {
          setSubmitError(`รายการที่ ${displayRowNo(line)}: น้ำหนักที่เบิกเกินยอดคงเหลือ (มี ${maxWtBalance.toFixed(2)} กก.)`);
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
          vehicleRegistration: header.vehicle_registration,
          requiresR3Document: header.requires_r3_document,
        });

        if (updateResult.error) {
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
          vehicleRegistration: header.vehicle_registration,
          requiresR3Document: header.requires_r3_document,
          customerId: isRequestProxy ? proxyCustomerId : null,
        });

        if (createResult.error) {
          setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
          return;
        }

        requestId = createResult.data?.id;

        if (!requestId) {
          setSubmitError('ไม่สามารถสร้างคำขอได้ กรุณาลองใหม่');
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

      for (let index = 0; index < activeLines.length; index += 1) {
        const line = activeLines[index];
        const normalizedLot = normalizeLotNo(line.lot_no);
        const matchedDepositLine = getMatchedDepositLine(line, allDepositLines);
        const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
          lineId: isEditMode ? (line.lineId ?? null) : null,
          lineNo: index + 1,
          sourceDepositRequestId: line.source_deposit_request_id || null,
          sourceDepositRequestLineId: line.source_deposit_request_line_id || null,
          sourceLotNo: normalizedLot,
          trackingCode: matchedDepositLine?.tracking_code || null,
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
          note: line.note,
          packEntryMode: line.withdrawal_qty_mode,
        });

        if (lineResult.error) {
          const rawMessage = lineResult.error.message ?? t('customer_portal_load_error');
          setSubmitError(`รายการที่ ${displayRowNo(line)}: ${rawMessage}`);
          return;
        }

        if (lineResult.data?.id) {
          const newLineId = lineResult.data.id;
          line.lineId = newLineId;
          setLines((current) => current.map((l) => (l.key === line.key ? { ...l, lineId: newLineId } : l)));
          setEditOriginalLineIds((current) => (current.includes(newLineId) ? current : [...current, newLineId]));
        }
      }

      if (!shouldSubmit) {
        navigate(`/customer/withdrawal-request/new?editId=${requestId}`, { replace: true });
        return;
      }

      const submitResult = await submitCustomerWithdrawalRequest(requestId);

      if (submitResult.error) {
        setSubmitError(submitResult.error.message ?? t('customer_portal_load_error'));
        return;
      }

      navigate('/customer/withdrawal-request');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleSaveDraft(event) {
    event.preventDefault();
    await saveFormData(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveFormData(true);
  }

  // Mirrors the same check saveFormData() runs before it will actually submit —
  // computed here too so the submit button is visibly locked up front instead
  // of only failing with an error banner after the customer clicks it.
  const allDepositLinesForBalanceCheck = Object.values(depositLinesMap).flat();
  const hasBalanceExceeded = lines.some((line) => {
    const { exceedsBoxBalance, exceedsWtBalance } = getWithdrawalBalanceInfo(line, allDepositLinesForBalanceCheck, lines);
    return exceedsBoxBalance || exceedsWtBalance;
  });

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
      {importNotice ? <div className="banner banner-warning" role="status">{importNotice}</div> : null}

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
              <ExcelImportExportToolbar
                disabled={!canWriteCustomerRequests || importing}
                exportTestId="customer-withdrawal-export-button"
                importTestId="customer-withdrawal-import-input"
                onExport={() => exportCustomerWithdrawalLinesExcel(lines)}
                onImportFile={handleImportFile}
                onTemplate={() => downloadCustomerWithdrawalLineTemplate(Object.values(depositLinesMap).flat())}
                templateTestId="customer-withdrawal-template-button"
              />
              <button className="btn btn-secondary" data-testid="customer-withdrawal-add-line-button" disabled={importing} onClick={addLine} type="button">
                {t('customer_deposit_add_line')}
              </button>
            </div>
          </div>

          <CustomerWithdrawalLinesTable
            customerId={effectiveCustomerId}
            depositLinesMap={depositLinesMap}
            lines={lines}
            onChange={setLines}
            onRemoveLine={removeLine}
          />
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_requested_dispatch_date')}</span>
            <DateInputDMY className="form-control" data-testid="customer-withdrawal-dispatch-date" max={maxDispatchDateIso()} min={new Date().toISOString().split('T')[0]} onChange={(e) => updateHeaderField('requested_dispatch_date', e.target.value)} required value={header.requested_dispatch_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_pickup_contact')}</span>
            <input className="form-control" data-testid="customer-withdrawal-pickup-contact" onChange={(e) => updateHeaderField('pickup_contact', e.target.value)} required value={header.pickup_contact} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_destination')}</span>
            <input className="form-control" onChange={(e) => updateHeaderField('destination', e.target.value)} value={header.destination} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_vehicle_registration')}</span>
            <input className="form-control" data-testid="customer-withdrawal-vehicle-registration" onChange={(e) => updateHeaderField('vehicle_registration', e.target.value)} value={header.vehicle_registration} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateHeaderField('note', e.target.value)} rows={3} value={header.note} />
          </label>
          <label className="form-field form-field-span-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              data-testid="customer-withdrawal-r3-document"
              checked={header.requires_r3_document}
              onChange={(e) => updateHeaderField('requires_r3_document', e.target.checked)}
            />
            <span>{t('customer_field_r3_document')}</span>
          </label>
        </div>
        {hasBalanceExceeded ? (
          <div className="banner banner-danger" role="alert" data-testid="customer-withdrawal-balance-exceeded-banner">
            มีรายการเบิกเกินยอดคงเหลือ กรุณาแก้ไขจำนวนกล่อง/น้ำหนักให้ไม่เกินยอดคงเหลือก่อนส่งคำขอ
          </div>
        ) : null}
        <div className="action-row customer-portal-form-actions">
          <Link className="btn btn-secondary" to="/customer/withdrawal-request">{t('close')}</Link>
          <button className="btn btn-secondary" data-testid="customer-withdrawal-save-draft-button" disabled={submitting} onClick={handleSaveDraft} type="button">
            {submitting ? t('customer_withdrawal_submitting') : 'บันทึกร่าง'}
          </button>
          <button
            className="btn btn-primary"
            data-testid="customer-withdrawal-submit-button"
            disabled={submitting || hasBalanceExceeded}
            title={hasBalanceExceeded ? 'มีรายการเบิกเกินยอดคงเหลือ — แก้ไขก่อนส่งคำขอ' : undefined}
            type="submit"
          >
            {submitting ? t('customer_withdrawal_submitting') : 'ส่งยืนยันการแจ้งเบิก'}
          </button>
        </div>
      </form>
    </section>
  );
}
