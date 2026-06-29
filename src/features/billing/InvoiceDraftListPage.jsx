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
import { listBillingInvoiceDrafts, getBillingInvoiceDraftById } from '../../services/billingInvoiceDraftService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { canReadBillingInvoiceDrafts } from '../../security/billingInvoiceDraftPermissions.js';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { formatInvoiceDraftError } from '../../utils/billingInvoiceDraftUtils.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

export function InvoiceDraftListPage() {
  const { language } = useLanguage();
  const { role: userRole, ready: roleReady } = useUserRole();
  const canRead = roleReady && canReadBillingInvoiceDrafts(userRole);
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewDraft, setViewDraft] = useState(null);
  const [viewLines, setViewLines] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getCustomers().then((result) => {
      if (isMounted) setCustomers(result.data ?? []);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canRead) {
      setDrafts([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    listBillingInvoiceDrafts({
      customerId: filters.customerId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }).then((result) => {
      if (!isMounted) return;
      setDrafts(result.data ?? []);
      setError(result.error ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [canRead, filters.customerId, filters.status, filters.dateFrom, filters.dateTo]);

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

      <DashboardSection title="Invoice Draft List">
        <InvoiceDraftListTable data={filteredDrafts} loading={loading} error={error} onView={handleView} />
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
                    <th>สินค้า</th>
                    <th>ประเภท</th>
                    <th>วันที่</th>
                    <th style={{ textAlign: 'right' }}>จำนวน</th>
                    <th style={{ textAlign: 'right' }}>น้ำหนัก</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLines.length ? viewLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.source_document_no ?? '-'}</td>
                      <td>{line.product_name ?? line.product_code ?? '-'}</td>
                      <td>{line.movement_type ?? '-'}</td>
                      <td>{formatDocumentDate(line.movement_date, { dateOnly: true })}</td>
                      <td style={{ textAlign: 'right' }}>{line.qty ?? '-'}</td>
                      <td style={{ textAlign: 'right' }}>{line.chargeable_weight ?? '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center' }}>ไม่มีรายละเอียด</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      ) : null}

      <ReportPreviewModal
        open={printOpen}
        title={`Invoice Draft — ${viewDraft?.draft_no ?? ''}`}
        onClose={() => setPrintOpen(false)}
      >
        <InvoiceDraftPrintTemplate draft={viewDraft} lines={viewLines} />
      </ReportPreviewModal>
    </section>
  );
}
