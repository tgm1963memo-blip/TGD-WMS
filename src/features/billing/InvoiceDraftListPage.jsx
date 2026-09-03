import { Fragment, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { UatOnly } from '../../components/common/UatOnly.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { InvoiceDraftFilterPanel } from '../../components/billing/InvoiceDraftFilterPanel.jsx';
import { InvoiceDraftListTable } from '../../components/billing/InvoiceDraftListTable.jsx';
import { InvoiceDraftStatusBadge } from '../../components/billing/InvoiceDraftStatusBadge.jsx';
import { InvoiceDraftPrintTemplate } from '../../components/billing/InvoiceDraftPrintTemplate.jsx';
import { exportInvoiceDraftPdf } from '../../utils/invoiceDraftPdfExport.js';
import { ReportPreviewModal } from '../../components/reports/ReportPreviewModal.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import {
  listBillingInvoiceDrafts,
  getBillingInvoiceDraftById,
  deleteBillingInvoiceDraft,
  approveBillingInvoiceDraft,
  previewBillingPeriodInvoice,
  createBillingInvoiceDraftForPeriod,
  recalculateInvoiceDraftLineRates,
  saveLotBillingCutoffSeed,
  createAutoLotBillingDraft,
} from '../../services/billingInvoiceDraftService.js';
import { getAutoLotBillingPreview } from '../../services/billingRateEngineService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { TEMPERATURE_TYPES, upsertProductServiceRate } from '../../services/productServiceRatesService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { canReadBillingInvoiceDrafts, canWriteBillingInvoiceDrafts } from '../../security/billingInvoiceDraftPermissions.js';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  canApproveBillingInvoiceDraft, formatInvoiceDraftError, APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES,
} from '../../utils/billingInvoiceDraftUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { downloadExcelWorkbookMultiSheet } from '../../utils/excelFileUtils.js';

const UNRATED_REASON_LABELS = {
  NO_RATE_CONFIGURED: 'ไม่มีอัตราค่าฝากที่ตั้งค่าไว้',
  CONTRACT_NOT_STARTED: 'สัญญายังไม่เริ่ม ณ วันที่รับฝาก',
  CONTRACT_EXPIRED: 'สัญญาหมดอายุแล้ว ณ วันที่รับฝาก',
};

const SOURCE_DOCUMENT_TYPE_LABELS = {
  STORAGE: 'ค่าฝากสินค้า',
  HANDLING_IN: 'ค่าบริการจัดการแรกเข้า',
  SERVICE: 'ค่าบริการเสริม',
};

export function InvoiceDraftListPage() {
  const { language } = useLanguage();
  const { role: userRole, ready: roleReady } = useUserRole();
  const canRead = roleReady && canReadBillingInvoiceDrafts(userRole);
  const canWrite = roleReady && canWriteBillingInvoiceDrafts(userRole);
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewDraft, setViewDraft] = useState(null);
  const [viewLines, setViewLines] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approveError, setApproveError] = useState(null);
  const [recalculatingId, setRecalculatingId] = useState(null);
  const [recalculateError, setRecalculateError] = useState(null);
  const [recalculateMsg, setRecalculateMsg] = useState('');
  const [storageBillOpen, setStorageBillOpen] = useState(false);
  const [storageBillMode, setStorageBillMode] = useState('manual');
  const [storageBillCustomerId, setStorageBillCustomerId] = useState('');
  const [storageBillTemperatureType, setStorageBillTemperatureType] = useState('');
  const [storageBillStart, setStorageBillStart] = useState('');
  const [storageBillEnd, setStorageBillEnd] = useState('');
  const [storageBillPreview, setStorageBillPreview] = useState(null);
  const [storageBillLoading, setStorageBillLoading] = useState(false);
  const [storageBillError, setStorageBillError] = useState(null);
  const [storageBillSaving, setStorageBillSaving] = useState(false);
  // Inline "set a rate" form for an unrated line in the storage-bill preview
  // (see storageBillPreview.unratedDepositLines) — keyed by the unrated
  // item's own index in that array, since it has no stable id of its own.
  const [unratedRateFormIdx, setUnratedRateFormIdx] = useState(null);
  const [unratedRateInputs, setUnratedRateInputs] = useState({ rate: '', periodDays: '30' });
  const [unratedRateSaving, setUnratedRateSaving] = useState(false);
  const [unratedRateError, setUnratedRateError] = useState('');
  const [autoBillThroughDate, setAutoBillThroughDate] = useState('');
  const [autoBillPreview, setAutoBillPreview] = useState(null);
  const [autoBillLoading, setAutoBillLoading] = useState(false);
  const [autoBillError, setAutoBillError] = useState(null);
  const [autoBillSaving, setAutoBillSaving] = useState(false);
  const [seedInputs, setSeedInputs] = useState({});
  const [seedSavingId, setSeedSavingId] = useState(null);
  const [seedErrorsById, setSeedErrorsById] = useState({});

  useEffect(() => {
    let isMounted = true;
    getCustomers().then((result) => {
      if (isMounted) setCustomers(result.data ?? []);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  function reloadDrafts() {
    if (!canRead) {
      setDrafts([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    return listBillingInvoiceDrafts({
      customerId: filters.customerId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }).then((result) => {
      setDrafts(result.data ?? []);
      setError(result.error ?? null);
      setLoading(false);
    });
  }

  useEffect(() => {
    let isMounted = true;
    Promise.resolve(reloadDrafts()).then(() => {
      if (!isMounted) return;
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, filters.customerId, filters.status, filters.dateFrom, filters.dateTo]);

  async function handleDelete(draft) {
    if (!draft?.id) return;
    const confirmed = window.confirm(`ลบร่างใบแจ้งหนี้ ${draft.draft_no ?? ''}? รายการเคลื่อนไหวที่ใช้จะกลับไปเลือกสร้างร่างใหม่ได้`);
    if (!confirmed) return;

    setDeletingId(draft.id);
    setDeleteError(null);
    const result = await deleteBillingInvoiceDraft({ draftId: draft.id });
    setDeletingId(null);

    if (result.error) {
      setDeleteError(result.error);
      return;
    }

    reloadDrafts();
  }

  async function handleApprove(draft) {
    if (!draft?.id || !canApproveBillingInvoiceDraft(draft)) return;
    const confirmed = window.confirm(`Approve invoice draft ${draft.draft_no ?? ''}?`);
    if (!confirmed) return;

    setApprovingId(draft.id);
    setApproveError(null);
    const result = await approveBillingInvoiceDraft({ draftId: draft.id });
    setApprovingId(null);

    if (result.error) {
      setApproveError(result.error);
      return;
    }

    // Keep the open "View" modal in sync so its status badge reflects the
    // approval right away, instead of still showing the stale DRAFT status
    // until the modal is closed and reopened.
    setViewDraft((prev) => (prev && prev.id === draft.id ? { ...prev, status: 'APPROVED' } : prev));
    reloadDrafts();
  }

  async function handleRecalculate(draft) {
    if (!draft?.id) return;
    setRecalculatingId(draft.id);
    setRecalculateError(null);
    setRecalculateMsg('');
    const result = await recalculateInvoiceDraftLineRates(draft.id);
    setRecalculatingId(null);

    if (result.error) {
      setRecalculateError(result.error);
      return;
    }

    setRecalculateMsg(
      result.data.updatedCount > 0
        ? `คำนวณอัตราใหม่แล้ว ${result.data.updatedCount} รายการ`
        : 'ไม่มีรายการที่ต้องคำนวณอัตราใหม่'
    );
    reloadDrafts();
  }

  function openStorageBillModal() {
    setStorageBillOpen(true);
    setStorageBillMode('manual');
    setStorageBillCustomerId('');
    setStorageBillTemperatureType('');
    setStorageBillStart('');
    setStorageBillEnd('');
    setStorageBillPreview(null);
    setStorageBillError(null);
    setAutoBillThroughDate(new Date().toISOString().slice(0, 10));
    setAutoBillPreview(null);
    setAutoBillError(null);
    setSeedInputs({});
    setSeedErrorsById({});
  }

  async function handleStorageBillPreview() {
    if (!storageBillCustomerId || !storageBillStart || !storageBillEnd) {
      setStorageBillError({ message: 'กรุณาเลือกลูกค้าและช่วงเวลาบิลให้ครบ' });
      return;
    }
    setStorageBillLoading(true);
    setStorageBillError(null);
    const result = await previewBillingPeriodInvoice({
      customerId: storageBillCustomerId,
      billingPeriodStart: storageBillStart,
      billingPeriodEnd: storageBillEnd,
      temperatureType: storageBillTemperatureType || undefined,
    });
    setStorageBillLoading(false);
    if (result.error) {
      setStorageBillError(result.error);
      setStorageBillPreview(null);
      return;
    }
    setStorageBillPreview(result.data);
  }

  function openUnratedRateForm(idx) {
    setUnratedRateFormIdx(idx);
    setUnratedRateInputs({ rate: '', periodDays: '30' });
    setUnratedRateError('');
  }

  // Sets a live STORAGE rate for an unrated lot straight from this preview,
  // then re-runs the preview so it picks the new rate up immediately —
  // avoids the previous round-trip of noting the product code here, leaving
  // to the Product Service Rates admin page, then coming back to re-preview.
  //
  // Scope is chosen automatically, most specific first: a catalog entry for
  // this exact customer_product_code (rate applies to only that one SKU) if
  // one exists, else a customer-wide rate scoped to this lot's own
  // temperature_type, else (only when the lot has no temperature_type on
  // record either) a plain customer-wide rate with no restriction at all —
  // the broadest tier, which also matches every OTHER unrated/future item
  // for this customer with no temperature recorded, so it's confirmed with
  // the user before saving rather than applied silently.
  async function handleSaveUnratedRate(unratedItem) {
    const rateValue = Number(unratedRateInputs.rate);
    const periodDaysValue = Number(unratedRateInputs.periodDays);
    if (!rateValue || rateValue <= 0) {
      setUnratedRateError('กรุณาระบุอัตราค่าฝากเป็นตัวเลขมากกว่า 0');
      return;
    }
    if (!periodDaysValue || periodDaysValue <= 0) {
      setUnratedRateError('กรุณาระบุจำนวนวันต่อรอบเป็นตัวเลขมากกว่า 0');
      return;
    }

    setUnratedRateSaving(true);
    setUnratedRateError('');

    let customerProductId = null;
    if (unratedItem.customerProductCode) {
      const catalogResult = await listCustomerProducts({ customerId: storageBillCustomerId, search: unratedItem.customerProductCode });
      if (catalogResult.error) {
        setUnratedRateSaving(false);
        setUnratedRateError(formatInvoiceDraftError(catalogResult.error));
        return;
      }
      const exactMatch = (catalogResult.data ?? []).find(
        (p) => p.customer_product_code === unratedItem.customerProductCode,
      );
      customerProductId = exactMatch?.id ?? null;
    }

    const scopeDescription = customerProductId
      ? `เฉพาะรหัสสินค้า ${unratedItem.customerProductCode} ของลูกค้ารายนี้เท่านั้น`
      : unratedItem.temperatureType
        ? `ทุกสินค้าประเภทจัดเก็บ "${unratedItem.temperatureType}" ของลูกค้ารายนี้ (ไม่พบสินค้านี้ในแคตตาล็อก จึงตั้งตามประเภทจัดเก็บแทน)`
        : `ทุกสินค้าของลูกค้ารายนี้แบบไม่จำกัดประเภท (ไม่พบสินค้านี้ในแคตตาล็อกและไม่มีประเภทจัดเก็บระบุไว้ — เป็นขอบเขตกว้างที่สุด จะกระทบสินค้าอื่นที่ยังไม่มีอัตราด้วย)`;
    const confirmed = window.confirm(
      `ตั้งอัตราค่าฝาก ${rateValue} บาท/กก./รอบ${periodDaysValue} วัน จะมีผลกับ: ${scopeDescription}\n\nยืนยันบันทึก?`,
    );
    if (!confirmed) {
      setUnratedRateSaving(false);
      return;
    }

    const result = await upsertProductServiceRate({
      customerId: customerProductId ? null : storageBillCustomerId,
      customerProductId,
      serviceType: 'STORAGE',
      rate: rateValue,
      unitBasis: 'PER_KG',
      periodDays: periodDaysValue,
      temperatureType: customerProductId ? null : (unratedItem.temperatureType || null),
    });
    setUnratedRateSaving(false);
    if (result.error) {
      setUnratedRateError(formatInvoiceDraftError(result.error));
      return;
    }

    setUnratedRateFormIdx(null);
    await handleStorageBillPreview();
  }

  // Two review files per the billing SOP: one workbook with every matched
  // invoice line (traceable back to customer/lot/rate), one with unmatched
  // deposit lines + the anomaly flag — both available BEFORE committing,
  // so accounting can review offline instead of only in-browser.
  //
  // The short delay between the two downloadExcelWorkbookMultiSheet calls
  // is required, not cosmetic: Chrome (and other Chromium browsers) treats
  // two script-triggered file downloads fired back-to-back in the same
  // synchronous call stack as a "multiple automatic downloads" attempt and
  // silently blocks the second one — confirmed by an E2E test that only
  // ever saw the first file land. Yielding a macrotask between them keeps
  // each download tied to its own turn of the event loop, which Chrome
  // treats as distinct user-triggered downloads instead of a batch.
  async function handleDownloadPreviewReports() {
    if (!storageBillPreview) return;
    const stamp = `${storageBillCustomerId}_${storageBillStart}_${storageBillEnd}`;

    const summaryRows = [
      ...Object.entries(storageBillPreview.totalsByType ?? {}).map(([type, amount]) => ({
        รายการ: SOURCE_DOCUMENT_TYPE_LABELS[type] ?? type,
        จำนวนเงิน: amount,
      })),
      { รายการ: 'รวมทั้งสิ้น', จำนวนเงิน: storageBillPreview.totals?.total_amount ?? 0 },
    ];
    const lineRows = (storageBillPreview.lines ?? []).map((l) => ({
      ประเภท: SOURCE_DOCUMENT_TYPE_LABELS[l.source_document_type] ?? l.source_document_type,
      รหัสสินค้า: l.product_code ?? '-',
      lot: l.lot_no ?? '-',
      น้ำหนัก_จำนวน: l.chargeable_weight ?? l.qty ?? '-',
      งวด_วัน: l.storage_days ?? '-',
      อัตรา: l.rate ?? '-',
      จำนวนเงิน: l.amount ?? 0,
      หมายเหตุ_การปรับยอด: l.adjustment_note ?? '-',
    }));
    downloadExcelWorkbookMultiSheet(
      [
        { name: 'สรุป', rows: summaryRows, headers: ['รายการ', 'จำนวนเงิน'] },
        { name: 'รายการ', rows: lineRows, headers: ['ประเภท', 'รหัสสินค้า', 'lot', 'น้ำหนัก_จำนวน', 'งวด_วัน', 'อัตรา', 'จำนวนเงิน', 'หมายเหตุ_การปรับยอด'] },
      ],
      `invoice-preview-summary_${stamp}.xlsx`,
    );

    await new Promise((resolve) => { setTimeout(resolve, 400); });

    const unmatchedRows = (storageBillPreview.unratedDepositLines ?? []).map((u) => ({
      lot: u.lotNo ?? '-',
      รหัสสินค้า: u.customerProductCode ?? '-',
      วิธีจัดเก็บ: u.temperatureType ?? '-',
      เหตุผล: UNRATED_REASON_LABELS[u.reason] ?? u.reason ?? '-',
    }));
    const anomalyRows = storageBillPreview.anomaly ? [{
      งวดก่อนหน้า: storageBillPreview.anomaly.previousDraftNo ?? '-',
      ยอดงวดก่อนหน้า: storageBillPreview.anomaly.previousTotal,
      ยอดงวดนี้: storageBillPreview.anomaly.currentTotal,
      เปลี่ยนแปลง_เปอร์เซ็นต์: storageBillPreview.anomaly.percentChange,
    }] : [];
    downloadExcelWorkbookMultiSheet(
      [
        { name: 'unmatched', rows: unmatchedRows, headers: ['lot', 'รหัสสินค้า', 'วิธีจัดเก็บ', 'เหตุผล'] },
        { name: 'anomaly', rows: anomalyRows, headers: ['งวดก่อนหน้า', 'ยอดงวดก่อนหน้า', 'ยอดงวดนี้', 'เปลี่ยนแปลง_เปอร์เซ็นต์'] },
      ],
      `invoice-preview-unmatched-anomaly_${stamp}.xlsx`,
    );
  }

  async function handleStorageBillConfirm() {
    setStorageBillSaving(true);
    setStorageBillError(null);
    const result = await createBillingInvoiceDraftForPeriod({
      customerId: storageBillCustomerId,
      billingPeriodStart: storageBillStart,
      billingPeriodEnd: storageBillEnd,
      temperatureType: storageBillTemperatureType || undefined,
    });
    setStorageBillSaving(false);
    if (result.error) {
      setStorageBillError(result.error);
      return;
    }
    setStorageBillOpen(false);
    reloadDrafts();
  }

  async function handleAutoBillPreview() {
    if (!storageBillCustomerId || !autoBillThroughDate) {
      setAutoBillError({ message: 'กรุณาเลือกลูกค้าและวันที่คิดค่าฝากถึง' });
      return;
    }
    setAutoBillLoading(true);
    setAutoBillError(null);
    const result = await getAutoLotBillingPreview({
      customerId: storageBillCustomerId,
      billThroughDate: autoBillThroughDate,
      temperatureType: storageBillTemperatureType || undefined,
    });
    setAutoBillLoading(false);
    if (result.error) {
      setAutoBillError(result.error);
      setAutoBillPreview(null);
      return;
    }
    setAutoBillPreview(result.data);
  }

  async function handleSaveSeed(depositLineId) {
    const billedThroughDate = seedInputs[depositLineId];
    if (!billedThroughDate) return;
    setSeedSavingId(depositLineId);
    setSeedErrorsById((prev) => ({ ...prev, [depositLineId]: null }));
    const result = await saveLotBillingCutoffSeed({ depositLineId, billedThroughDate });
    setSeedSavingId(null);
    if (result.error) {
      setSeedErrorsById((prev) => ({ ...prev, [depositLineId]: formatInvoiceDraftError(result.error) }));
      return;
    }
    await handleAutoBillPreview();
  }

  async function handleAutoBillConfirm() {
    setAutoBillSaving(true);
    setAutoBillError(null);
    const result = await createAutoLotBillingDraft({
      customerId: storageBillCustomerId,
      billThroughDate: autoBillThroughDate,
      temperatureType: storageBillTemperatureType || undefined,
    });
    setAutoBillSaving(false);
    if (result.error) {
      setAutoBillError(result.error);
      return;
    }
    setStorageBillOpen(false);
    reloadDrafts();
  }

  function handleView(draft) {
    setViewDraft(draft);
    setViewLines([]);
    setViewLoading(true);
    getBillingInvoiceDraftById(draft.id).then((result) => {
      setViewLines(result.data?.lines ?? []);
      setViewLoading(false);
    });
  }

  const filteredDrafts = useMemo(() => {
    const draftNo = String(filters.draftNo ?? '').trim().toLowerCase();
    if (!draftNo) return drafts;
    return drafts.filter((draft) => String(draft.draft_no ?? '').toLowerCase().includes(draftNo));
  }, [drafts, filters.draftNo]);

  if (!roleReady) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-drafts-page">
        <LoadingState message="Loading permissions..." />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-drafts-page">
        <PageHeader
          title={getTranslation('billing_invoice_drafts', language) || 'Billing Invoice Drafts'}
          description={getTranslation('billing_invoice_drafts_description', language) || 'Review invoice draft headers created from billing movement weight rows.'}
        />
        <div
          className="section-card"
          role="alert"
          data-testid="billing-invoice-draft-permission-denied"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16 }}
        >
          {formatInvoiceDraftError({ code: 'INVOICE_DRAFT_PERMISSION_DENIED' })}
        </div>
      </section>
    );
  }

  return (
    <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-drafts-page">
      <PageHeader
        title={getTranslation('billing_invoice_drafts', language) || 'Billing Invoice Drafts'}
        description={getTranslation('billing_invoice_drafts_description', language) || 'Review invoice draft headers created from billing movement weight rows.'}
      />

      <UatOnly>
      <div className="section-card meeting-safety-panel warning-panel gate-readiness-panel" style={{ marginBottom: 16, padding: 12, background: '#fff8e8', border: '1px solid var(--tgd-primary-gold)' }}>
        <strong>Gate 3B-4 Readiness Preview</strong>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          Invoice drafts can be reviewed and approved from the detail page. Export to Bplus is not enabled yet.
        </p>
      </div>
      </UatOnly>

      <InvoiceDraftFilterPanel value={filters} onChange={setFilters} customers={customers} />

      {canWrite ? (
        <div style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-primary" data-testid="open-storage-bill-modal-button" onClick={openStorageBillModal}>
            + สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา
          </button>
        </div>
      ) : null}

      {deleteError ? (
        <div className="section-card" role="alert" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--tgd-danger)', background: '#fff5f5' }}>
          {formatInvoiceDraftError(deleteError)}
        </div>
      ) : null}

      {approveError ? (
        <div className="section-card" role="alert" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--tgd-danger)', background: '#fff5f5' }}>
          {formatInvoiceDraftError(approveError)}
        </div>
      ) : null}

      {recalculateError ? (
        <div className="section-card" role="alert" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--tgd-danger)', background: '#fff5f5' }}>
          {formatInvoiceDraftError(recalculateError)}
        </div>
      ) : null}

      {recalculateMsg ? (
        <div className="section-card" role="status" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--tgd-success)', background: '#f0fdf4' }}>
          {recalculateMsg}
        </div>
      ) : null}

      <DashboardSection title="Invoice Draft List">
        <InvoiceDraftListTable
          data={filteredDrafts}
          loading={loading || Boolean(deletingId)}
          error={error}
          onView={handleView}
          onDelete={handleDelete}
          onApprove={handleApprove}
          approvingId={approvingId}
          onRecalculate={handleRecalculate}
          recalculatingId={recalculatingId}
          canWrite={canWrite}
        />
      </DashboardSection>

      {viewDraft ? (
        <Modal
          isOpen
          onClose={() => { setViewDraft(null); setPrintOpen(false); }}
          size="lg"
          title={`เอกสาร ${viewDraft.draft_no ?? ''}`}
        >
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-primary-gold"
              onClick={() => setPrintOpen(true)}
              disabled={viewLoading}
            >
              พิมพ์ / Print Invoice
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 14 }}>
            <div><strong>Draft No:</strong> {viewDraft.draft_no ?? '-'}</div>
            <div><strong>ลูกค้า:</strong> {viewDraft.customer_name ?? '-'}</div>
            <div><strong>สถานะ:</strong> <InvoiceDraftStatusBadge status={viewDraft.status} /></div>
            <div><strong>วันที่สร้าง:</strong> {formatDocumentDate(viewDraft.created_at)}</div>
            <div><strong>ช่วงเวลา (เริ่ม):</strong> {viewDraft.billing_period_start ?? '-'}</div>
            <div><strong>ช่วงเวลา (สิ้นสุด):</strong> {viewDraft.billing_period_end ?? '-'}</div>
            <div><strong>จำนวนรวม:</strong> {formatFixed2(viewDraft.total_qty)}</div>
            <div><strong>น้ำหนักรวม:</strong> {formatFixed2(viewDraft.total_chargeable_weight)}</div>
            <div><strong>มูลค่ารวม:</strong> {formatFixed2(viewDraft.total_amount)}</div>
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>รายละเอียด</h4>
          {viewLoading ? <LoadingState /> : (
            <div className="responsive-table">
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th>ประเภท</th>
                    <th style={{ textAlign: 'right' }}>จำนวน</th>
                    <th style={{ textAlign: 'right' }}>น้ำหนัก</th>
                    <th style={{ textAlign: 'center' }}>งวด/วัน</th>
                    <th style={{ textAlign: 'right' }}>อัตรา</th>
                    <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLines.length ? viewLines.map((line, idx) => (
                    <tr key={line.id}>
                      <td>{idx + 1}</td>
                      <td>{line.product_code ?? '-'}</td>
                      <td>{line.product_name ?? '-'}{line.line_note ? <div style={{ fontSize: 11, color: '#888' }}>{line.line_note}</div> : null}</td>
                      <td>{line.movement_type ?? '-'}</td>
                      <td style={{ textAlign: 'right' }}>{formatFixed2(line.qty)}</td>
                      <td style={{ textAlign: 'right' }}>{formatFixed2(line.chargeable_weight)}</td>
                      <td style={{ textAlign: 'center' }}>{line.storage_days != null ? `${line.storage_days} วัน` : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{line.rate ?? '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatFixed2(line.amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={9} style={{ textAlign: 'center' }}>ไม่มีรายละเอียด</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {canWrite && canApproveBillingInvoiceDraft(viewDraft) ? (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                data-testid={`invoice-draft-view-approve-button-${viewDraft.id}`}
                onClick={() => handleApprove(viewDraft)}
                disabled={approvingId === viewDraft.id}
              >
                {approvingId === viewDraft.id ? 'Approving...' : 'Approve Draft'}
              </button>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {storageBillOpen ? (
        <Modal
          isOpen
          onClose={() => setStorageBillOpen(false)}
          size="lg"
          title="สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา"
        >
          <div className="btn-group" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={storageBillMode === 'manual' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setStorageBillMode('manual')}
            >
              ตามช่วงเวลาที่ระบุเอง
            </button>
            <button
              type="button"
              className={storageBillMode === 'auto' ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setStorageBillMode('auto')}
            >
              งวดอัตโนมัติต่อล็อต
            </button>
          </div>

          {storageBillMode === 'manual' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              ลูกค้า *
              <select
                className="form-control"
                data-testid="storage-bill-customer-select"
                value={storageBillCustomerId}
                onChange={(e) => { setStorageBillCustomerId(e.target.value); setStorageBillPreview(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">— เลือกลูกค้า —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_code} — {c.customer_name}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              ประเภทสินค้าตามการจัดเก็บ
              <select
                className="form-control"
                value={storageBillTemperatureType}
                onChange={(e) => { setStorageBillTemperatureType(e.target.value); setStorageBillPreview(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {TEMPERATURE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              ช่วงเวลา (เริ่ม) *
              <input
                type="date"
                className="form-control"
                data-testid="storage-bill-start-date-input"
                value={storageBillStart}
                onChange={(e) => { setStorageBillStart(e.target.value); setStorageBillPreview(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              ช่วงเวลา (สิ้นสุด) *
              <input
                type="date"
                className="form-control"
                data-testid="storage-bill-end-date-input"
                value={storageBillEnd}
                onChange={(e) => { setStorageBillEnd(e.target.value); setStorageBillPreview(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                ลูกค้า *
                <select
                  className="form-control"
                  value={storageBillCustomerId}
                  onChange={(e) => { setStorageBillCustomerId(e.target.value); setAutoBillPreview(null); }}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                >
                  <option value="">— เลือกลูกค้า —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customer_code} — {c.customer_name}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                ประเภทสินค้าตามการจัดเก็บ
                <select
                  className="form-control"
                  value={storageBillTemperatureType}
                  onChange={(e) => { setStorageBillTemperatureType(e.target.value); setAutoBillPreview(null); }}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                >
                  {TEMPERATURE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                คิดค่าฝากถึงวันที่ *
                <input
                  type="date"
                  className="form-control"
                  value={autoBillThroughDate}
                  onChange={(e) => { setAutoBillThroughDate(e.target.value); setAutoBillPreview(null); }}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
            </div>
          )}

          {storageBillMode === 'manual' && storageBillError ? (
            <div className="banner banner-danger" style={{ marginBottom: 12 }}>{formatInvoiceDraftError(storageBillError)}</div>
          ) : null}
          {storageBillMode === 'auto' && autoBillError ? (
            <div className="banner banner-danger" style={{ marginBottom: 12 }}>{formatInvoiceDraftError(autoBillError)}</div>
          ) : null}

          {storageBillMode === 'manual' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary" data-testid="storage-bill-preview-button" onClick={handleStorageBillPreview} disabled={storageBillLoading}>
              {storageBillLoading ? 'กำลังคำนวณ...' : 'ดูตัวอย่างก่อนสร้าง'}
            </button>
          </div>
          ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={handleAutoBillPreview} disabled={autoBillLoading}>
              {autoBillLoading ? 'กำลังคำนวณ...' : 'ดูตัวอย่างก่อนสร้าง'}
            </button>
          </div>
          )}

          {storageBillMode === 'auto' && autoBillPreview ? (
            <div>
              <div className="responsive-table" style={{ marginBottom: 12 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>ล็อต</th>
                      <th>รหัสสินค้า</th>
                      <th>งวด (วันที่)</th>
                      <th style={{ textAlign: 'center' }}>วัน</th>
                      <th style={{ textAlign: 'right' }}>น้ำหนักเฉลี่ย</th>
                      <th style={{ textAlign: 'right' }}>อัตรา</th>
                      <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoBillPreview.lots.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center' }}>ไม่พบล็อตที่มีอัตราค่าฝากแบบรายงวดสำหรับลูกค้านี้</td></tr>
                    ) : null}
                    {autoBillPreview.lots.map((lot) => (
                      lot.needsSetup ? (
                        <tr key={lot.depositLineId}>
                          <td>{lot.lotNo ?? '-'}</td>
                          <td>{lot.customerProductCode ?? '-'}</td>
                          <td colSpan={4}>
                            <span style={{ color: '#b45309', marginRight: 8 }}>
                              ล็อตนี้ยังไม่เคยตั้งค่า — ระบุวันที่ "คิดค่าฝากไปแล้วถึงวันที่"
                            </span>
                            <input
                              type="date"
                              style={{ marginRight: 8 }}
                              value={seedInputs[lot.depositLineId] ?? ''}
                              onChange={(e) => setSeedInputs((prev) => ({ ...prev, [lot.depositLineId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={seedSavingId === lot.depositLineId || !seedInputs[lot.depositLineId]}
                              onClick={() => handleSaveSeed(lot.depositLineId)}
                            >
                              {seedSavingId === lot.depositLineId ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                            {seedErrorsById[lot.depositLineId] ? (
                              <div style={{ color: 'var(--tgd-danger)', fontSize: 11, marginTop: 4 }}>{seedErrorsById[lot.depositLineId]}</div>
                            ) : null}
                          </td>
                        </tr>
                      ) : lot.cycles.map((cycle, idx) => (
                        <tr key={`${lot.depositLineId}-${idx}`}>
                          <td>{lot.lotNo ?? '-'}</td>
                          <td>{lot.customerProductCode ?? '-'}</td>
                          <td>{cycle.periodStart} — {cycle.periodEnd}</td>
                          <td style={{ textAlign: 'center' }}>{cycle.days ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>{cycle.weight ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>{cycle.rate?.rate ?? '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{cycle.amount != null ? cycle.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
              {(() => {
                const totalAmount = autoBillPreview.lots
                  .flatMap((lot) => lot.cycles)
                  .reduce((sum, c) => sum + (c.amount ?? 0), 0);
                const billableCount = autoBillPreview.lots.reduce((sum, lot) => sum + lot.cycles.length, 0);
                return (
                  <>
                    <div style={{ textAlign: 'right', fontWeight: 700, marginBottom: 16 }}>
                      รวมทั้งสิ้น: {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setStorageBillOpen(false)}>ยกเลิก</button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAutoBillConfirm}
                        disabled={autoBillSaving || billableCount === 0}
                      >
                        {autoBillSaving ? 'กำลังบันทึก...' : 'ยืนยันสร้างร่างบิล'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}

          {storageBillMode === 'manual' && storageBillPreview ? (
            <div>
              <div className="responsive-table" style={{ marginBottom: 12 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th>ประเภท</th>
                      <th style={{ textAlign: 'right' }}>น้ำหนัก/จำนวน</th>
                      <th style={{ textAlign: 'center' }}>งวด/วัน</th>
                      <th style={{ textAlign: 'right' }}>อัตรา</th>
                      <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageBillPreview.lines.length ? storageBillPreview.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          {line.product_name ?? line.product_code ?? '-'}
                          <div style={{ fontSize: 11, color: '#888' }}>{line.line_note}</div>
                        </td>
                        <td>{SOURCE_DOCUMENT_TYPE_LABELS[line.source_document_type] ?? line.source_document_type}</td>
                        <td style={{ textAlign: 'right' }}>{line.chargeable_weight ?? line.qty ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>{line.storage_days != null ? `${line.storage_days} วัน` : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{line.rate ?? '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.amount != null ? line.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} style={{ textAlign: 'center' }}>ไม่พบรายการที่คำนวณได้ในช่วงเวลานี้</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {storageBillPreview.unratedDepositLines?.length > 0 ? (
                <div className="banner banner-warning" style={{ marginBottom: 12 }} data-testid="storage-bill-unmatched-section">
                  <strong>รายการที่ไม่มีสัญญา/อัตรารองรับ ({storageBillPreview.unratedDepositLines.length} รายการ)</strong> — ไม่ถูกนำมาคำนวณในบิลนี้
                  <div className="responsive-table" style={{ marginTop: 8 }}>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Lot</th>
                          <th>รหัสสินค้า</th>
                          <th>วิธีจัดเก็บ</th>
                          <th style={{ textAlign: 'right' }}>จำนวน (กก.)</th>
                          <th>เหตุผล</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageBillPreview.unratedDepositLines.map((u, idx) => (
                          <Fragment key={idx}>
                            <tr>
                              <td>{u.lotNo ?? '-'}</td>
                              <td>{u.customerProductCode ?? '-'}</td>
                              <td>{u.temperatureType ?? '-'}</td>
                              <td style={{ textAlign: 'right' }}>{u.weight != null ? u.weight.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                              <td>{UNRATED_REASON_LABELS[u.reason] ?? u.reason ?? '-'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  data-testid={`unrated-set-rate-button-${idx}`}
                                  onClick={() => (unratedRateFormIdx === idx ? setUnratedRateFormIdx(null) : openUnratedRateForm(idx))}
                                >
                                  {unratedRateFormIdx === idx ? 'ยกเลิก' : 'ตั้งค่าอัตรา'}
                                </button>
                              </td>
                            </tr>
                            {unratedRateFormIdx === idx ? (
                              <tr>
                                <td colSpan={6} style={{ background: '#fffdf5' }}>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: '8px 0' }}>
                                    <label style={{ fontSize: 12, fontWeight: 600 }}>
                                      อัตรา (บาท/กก./รอบ)
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-control"
                                        style={{ display: 'block', width: 140, marginTop: 4 }}
                                        value={unratedRateInputs.rate}
                                        onChange={(e) => setUnratedRateInputs((prev) => ({ ...prev, rate: e.target.value }))}
                                        data-testid={`unrated-rate-input-${idx}`}
                                      />
                                    </label>
                                    <label style={{ fontSize: 12, fontWeight: 600 }}>
                                      จำนวนวันต่อรอบ
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="form-control"
                                        style={{ display: 'block', width: 100, marginTop: 4 }}
                                        value={unratedRateInputs.periodDays}
                                        onChange={(e) => setUnratedRateInputs((prev) => ({ ...prev, periodDays: e.target.value }))}
                                        data-testid={`unrated-period-days-input-${idx}`}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      disabled={unratedRateSaving}
                                      onClick={() => handleSaveUnratedRate(u)}
                                      data-testid={`unrated-save-rate-button-${idx}`}
                                    >
                                      {unratedRateSaving ? 'กำลังบันทึก...' : 'บันทึกอัตราและคำนวณใหม่'}
                                    </button>
                                  </div>
                                  {unratedRateError ? (
                                    <div className="banner banner-danger" style={{ padding: 8, fontSize: 12 }}>{unratedRateError}</div>
                                  ) : null}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {storageBillPreview.anomaly ? (
                <div className="banner banner-warning" style={{ marginBottom: 12 }} data-testid="storage-bill-anomaly-banner">
                  <strong>ยอดผิดปกติ:</strong> งวดนี้ {storageBillPreview.anomaly.currentTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  {' '}เทียบกับงวดก่อนหน้า ({storageBillPreview.anomaly.previousDraftNo ?? '-'}) {storageBillPreview.anomaly.previousTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  {' '}เปลี่ยนแปลง {storageBillPreview.anomaly.percentChange > 0 ? '+' : ''}{storageBillPreview.anomaly.percentChange}% (เกิน 30%) กรุณาตรวจสอบก่อนยืนยัน
                </div>
              ) : null}

              {storageBillPreview.totalsByType && Object.keys(storageBillPreview.totalsByType).length > 0 ? (
                <div style={{ textAlign: 'right', fontSize: 12, color: '#475569', marginBottom: 4 }} data-testid="storage-bill-totals-by-type">
                  {Object.entries(storageBillPreview.totalsByType).map(([type, amount]) => (
                    <span key={type} style={{ marginLeft: 16 }}>
                      {SOURCE_DOCUMENT_TYPE_LABELS[type] ?? type}: {amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ textAlign: 'right', fontWeight: 700, marginBottom: 16 }}>
                รวมทั้งสิ้น: {storageBillPreview.totals.total_amount != null ? storageBillPreview.totals.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'} บาท
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-outline" data-testid="storage-bill-download-reports-button" onClick={handleDownloadPreviewReports}>
                  ดาวน์โหลดรายงานตรวจทาน
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setStorageBillOpen(false)}>ยกเลิก</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStorageBillConfirm}
                  disabled={storageBillSaving || storageBillPreview.lines.length === 0}
                >
                  {storageBillSaving ? 'กำลังบันทึก...' : 'ยืนยันสร้างร่างบิล'}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      <ReportPreviewModal
        open={printOpen}
        title={`${APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES.includes(viewDraft?.status) ? 'Invoice' : 'Invoice Draft'} — ${viewDraft?.draft_no ?? ''}`}
        orientation="landscape"
        onClose={() => setPrintOpen(false)}
        onDownloadPdf={() => exportInvoiceDraftPdf({ draft: viewDraft, lines: viewLines })}
      >
        <InvoiceDraftPrintTemplate draft={viewDraft} lines={viewLines} />
      </ReportPreviewModal>
    </section>
  );
}
