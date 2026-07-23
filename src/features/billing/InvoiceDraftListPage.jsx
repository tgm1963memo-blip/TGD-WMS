import { useEffect, useMemo, useState } from 'react';
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
import { ReportPreviewModal } from '../../components/reports/ReportPreviewModal.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import {
  listBillingInvoiceDrafts,
  getBillingInvoiceDraftById,
  deleteBillingInvoiceDraft,
  previewBillingPeriodInvoice,
  createBillingInvoiceDraftForPeriod,
  recalculateInvoiceDraftLineRates,
  saveLotBillingCutoffSeed,
  createAutoLotBillingDraft,
} from '../../services/billingInvoiceDraftService.js';
import { getAutoLotBillingPreview } from '../../services/billingRateEngineService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { canReadBillingInvoiceDrafts, canWriteBillingInvoiceDrafts } from '../../security/billingInvoiceDraftPermissions.js';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { formatInvoiceDraftError } from '../../utils/billingInvoiceDraftUtils.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

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
  const [recalculatingId, setRecalculatingId] = useState(null);
  const [recalculateError, setRecalculateError] = useState(null);
  const [recalculateMsg, setRecalculateMsg] = useState('');
  const [storageBillOpen, setStorageBillOpen] = useState(false);
  const [storageBillMode, setStorageBillMode] = useState('manual');
  const [storageBillCustomerId, setStorageBillCustomerId] = useState('');
  const [storageBillStart, setStorageBillStart] = useState('');
  const [storageBillEnd, setStorageBillEnd] = useState('');
  const [storageBillPreview, setStorageBillPreview] = useState(null);
  const [storageBillLoading, setStorageBillLoading] = useState(false);
  const [storageBillError, setStorageBillError] = useState(null);
  const [storageBillSaving, setStorageBillSaving] = useState(false);
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
    });
    setStorageBillLoading(false);
    if (result.error) {
      setStorageBillError(result.error);
      setStorageBillPreview(null);
      return;
    }
    setStorageBillPreview(result.data);
  }

  async function handleStorageBillConfirm() {
    setStorageBillSaving(true);
    setStorageBillError(null);
    const result = await createBillingInvoiceDraftForPeriod({
      customerId: storageBillCustomerId,
      billingPeriodStart: storageBillStart,
      billingPeriodEnd: storageBillEnd,
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
          <button type="button" className="btn btn-primary" onClick={openStorageBillModal}>
            + สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา
          </button>
        </div>
      ) : null}

      {deleteError ? (
        <div className="section-card" role="alert" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--tgd-danger)', background: '#fff5f5' }}>
          {formatInvoiceDraftError(deleteError)}
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
            <div><strong>จำนวนรวม:</strong> {viewDraft.total_qty ?? '-'}</div>
            <div><strong>น้ำหนักรวม:</strong> {viewDraft.total_chargeable_weight ?? '-'}</div>
            <div><strong>มูลค่ารวม:</strong> {viewDraft.total_amount ?? '-'}</div>
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>รายละเอียด</h4>
          {viewLoading ? <LoadingState /> : (
            <div className="responsive-table">
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>เอกสารต้นทาง</th>
                    <th>สินค้า / รายการ</th>
                    <th>ประเภท</th>
                    <th>วันที่</th>
                    <th style={{ textAlign: 'right' }}>จำนวน</th>
                    <th style={{ textAlign: 'right' }}>น้ำหนัก</th>
                    <th style={{ textAlign: 'center' }}>งวด/วัน</th>
                    <th style={{ textAlign: 'right' }}>อัตรา</th>
                    <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLines.length ? viewLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.source_document_no ?? '-'}</td>
                      <td>{line.product_name ?? line.product_code ?? '-'}{line.line_note ? <div style={{ fontSize: 11, color: '#888' }}>{line.line_note}</div> : null}</td>
                      <td>{line.movement_type ?? '-'}</td>
                      <td>{formatDocumentDate(line.movement_date, { dateOnly: true })}</td>
                      <td style={{ textAlign: 'right' }}>{line.qty ?? '-'}</td>
                      <td style={{ textAlign: 'right' }}>{line.chargeable_weight ?? '-'}</td>
                      <td style={{ textAlign: 'center' }}>{line.storage_days != null ? `${line.storage_days} วัน` : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{line.rate ?? '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.amount != null ? line.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={9} style={{ textAlign: 'center' }}>ไม่มีรายละเอียด</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              ลูกค้า *
              <select
                className="form-control"
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
              ช่วงเวลา (เริ่ม) *
              <input
                type="date"
                className="form-control"
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
                value={storageBillEnd}
                onChange={(e) => { setStorageBillEnd(e.target.value); setStorageBillPreview(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
            <button type="button" className="btn btn-secondary" onClick={handleStorageBillPreview} disabled={storageBillLoading}>
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
                        <td>{line.product_name ?? line.product_code ?? '-'}<div style={{ fontSize: 11, color: '#888' }}>{line.line_note}</div></td>
                        <td>{line.source_document_type}</td>
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
              <div style={{ textAlign: 'right', fontWeight: 700, marginBottom: 16 }}>
                รวมทั้งสิ้น: {storageBillPreview.totals.total_amount != null ? storageBillPreview.totals.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'} บาท
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
        title={`Invoice Draft — ${viewDraft?.draft_no ?? ''}`}
        orientation="landscape"
        onClose={() => setPrintOpen(false)}
      >
        <InvoiceDraftPrintTemplate draft={viewDraft} lines={viewLines} />
      </ReportPreviewModal>
    </section>
  );
}
