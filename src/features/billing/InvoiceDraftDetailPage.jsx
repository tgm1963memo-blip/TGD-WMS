import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { UatOnly } from '../../components/common/UatOnly.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { InvoiceDraftStatusBadge } from '../../components/billing/InvoiceDraftStatusBadge.jsx';
import { InvoiceDraftLinesTable } from '../../components/billing/InvoiceDraftLinesTable.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { InvoiceDraftBplusReadinessPanel } from '../../components/billing/InvoiceDraftBplusReadinessPanel.jsx';
import { InvoiceDraftPrintTemplate } from '../../components/billing/InvoiceDraftPrintTemplate.jsx';
import { ReportPreviewModal } from '../../components/reports/ReportPreviewModal.jsx';
import {
  approveBillingInvoiceDraft,
  cancelBillingInvoiceDraft,
  getBillingInvoiceDraftById,
  getBillingInvoiceDraftBplusExportReadiness,
} from '../../services/billingInvoiceDraftService.js';
import {
  canApproveBillingInvoiceDraft,
  canCancelBillingInvoiceDraft,
  formatInvoiceDraftError,
} from '../../utils/billingInvoiceDraftUtils.js';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import {
  canReadBillingInvoiceDrafts,
  canWriteBillingInvoiceDrafts,
} from '../../security/billingInvoiceDraftPermissions.js';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

export function InvoiceDraftDetailPage() {
  const { draftId } = useParams();
  const { language } = useLanguage();
  const { role: userRole, ready: roleReady } = useUserRole();
  const canRead = roleReady && canReadBillingInvoiceDrafts(userRole);
  const canWrite = roleReady && canWriteBillingInvoiceDrafts(userRole);
  const [state, setState] = useState({ draft: null, lines: [], loading: true, error: null });
  const [cancelError, setCancelError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [approveError, setApproveError] = useState(null);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approving, setApproving] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  async function loadDraft() {
    setState((current) => ({ ...current, loading: true, error: null }));
    const result = await getBillingInvoiceDraftById(draftId);
    if (result.error) {
      setState({ draft: null, lines: [], loading: false, error: result.error });
      return;
    }
    setState({
      draft: result.data?.draft ?? null,
      lines: result.data?.lines ?? [],
      loading: false,
      error: null,
    });
  }

  useEffect(() => {
    if (!draftId || !canRead) return undefined;
    let isMounted = true;

    getBillingInvoiceDraftById(draftId).then((result) => {
      if (!isMounted) return;
      if (result.error) {
        setState({ draft: null, lines: [], loading: false, error: result.error });
        return;
      }
      setState({
        draft: result.data?.draft ?? null,
        lines: result.data?.lines ?? [],
        loading: false,
        error: null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [canRead, draftId]);

  if (!roleReady) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-draft-detail-page">
        <LoadingState message="Loading permissions..." />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-draft-detail-page">
        <PageHeader title="Invoice Draft Detail" description="Access restricted." />
        <div
          className="section-card"
          role="alert"
          data-testid="billing-invoice-draft-permission-denied"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16 }}
        >
          {formatInvoiceDraftError({ code: 'INVOICE_DRAFT_PERMISSION_DENIED' })}
        </div>
        <Link className="btn btn-outline" to="/reports/billing-movement-weight">Back to Billing Report</Link>
      </section>
    );
  }

  async function handleCancel() {
    if (!state.draft || !canCancelBillingInvoiceDraft(state.draft)) return;

    const reason = window.prompt('Cancel reason (required):', 'Cancelled from UAT review');
    if (!reason || !reason.trim()) {
      setCancelError(new Error('Cancel reason is required.'));
      return;
    }

    const confirmed = window.confirm(`Cancel invoice draft ${state.draft.draft_no}?`);
    if (!confirmed) return;

    setCancelling(true);
    setCancelError(null);

    const result = await cancelBillingInvoiceDraft({
      draftId: state.draft.id,
      reason: reason.trim(),
    });

    setCancelling(false);

    if (result.error) {
      setCancelError(result.error);
      return;
    }

    await loadDraft();
  }

  async function handleApprove() {
    if (!state.draft || !canApproveBillingInvoiceDraft(state.draft)) return;

    const confirmed = window.confirm(`Approve invoice draft ${state.draft.draft_no}?`);
    if (!confirmed) return;

    setApproving(true);
    setApproveError(null);
    setApproveSuccess(false);

    const result = await approveBillingInvoiceDraft({
      draftId: state.draft.id,
    });

    setApproving(false);

    if (result.error) {
      setApproveError(result.error);
      return;
    }

    await loadDraft();
    setApproveSuccess(true);
    setReadiness(null);
    setReadinessError(null);
  }

  async function handlePreviewBplusReadiness() {
    if (!state.draft) return;

    setReadinessLoading(true);
    setReadinessError(null);

    const result = await getBillingInvoiceDraftBplusExportReadiness(state.draft.id);
    setReadinessLoading(false);

    if (result.error) {
      setReadinessError(result.error);
      setReadiness(null);
      return;
    }

    setReadiness(result.data ?? null);
  }

  if (state.loading) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-draft-detail-page">
        <LoadingState />
      </section>
    );
  }

  if (state.error || !state.draft) {
    return (
      <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-draft-detail-page">
        <PageHeader title="Invoice Draft Detail" description="Draft not found or unavailable." />
        <div className="section-card" role="alert" style={{ padding: 16, border: '1px solid var(--tgd-danger)' }}>
          {formatInvoiceDraftError(state.error) || 'Invoice draft not found.'}
        </div>
        <Link className="btn btn-outline" to="/billing/invoice-drafts">Back to Invoice Drafts</Link>
      </section>
    );
  }

  const { draft } = state;
  const canCancel = canWrite && canCancelBillingInvoiceDraft(draft);
  const canApprove = canWrite && canApproveBillingInvoiceDraft(draft);

  return (
    <section className={getPageShellClassName('page-shell')} data-testid="billing-invoice-draft-detail-page">
      <PageHeader
        title={getTranslation('billing_invoice_draft_detail', language) || 'Invoice Draft Detail'}
        description={draft.draft_no}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link className="btn btn-outline" to="/billing/invoice-drafts">Back to List</Link>
        {canApprove ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={approving || cancelling}
            data-testid="invoice-draft-approve-button"
          >
            {approving ? 'Approving...' : 'Approve Draft'}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleCancel}
            disabled={cancelling || approving}
            data-testid="invoice-draft-cancel-button"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Draft'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary-gold"
          onClick={() => setPrintOpen(true)}
          disabled={state.loading}
        >
          พิมพ์ / Print Invoice
        </button>
      </div>

      {approveSuccess ? (
        <div
          className="section-card"
          role="status"
          data-testid="invoice-draft-approve-success-alert"
          style={{ border: '1px solid #86efac', background: '#f0fdf4', padding: 16, marginBottom: 16 }}
        >
          Invoice draft approved.
        </div>
      ) : null}

      {approveError ? (
        <div
          className="section-card"
          role="alert"
          data-testid="invoice-draft-approve-error-alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
        >
          {formatInvoiceDraftError(approveError)}
        </div>
      ) : null}

      {cancelError ? (
        <div
          className="section-card"
          role="alert"
          data-testid="invoice-draft-validation-alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
        >
          {formatInvoiceDraftError(cancelError)}
        </div>
      ) : null}

      <DashboardSection title="Draft Summary">
        <div className="summary-grid">
          <div className="section-card"><strong>Draft No</strong><div>{draft.draft_no}</div></div>
          <div className="section-card"><strong>Customer</strong><div>{draft.customer_name ?? '-'}</div></div>
          <div className="section-card"><strong>Status</strong><div><InvoiceDraftStatusBadge status={draft.status} /></div></div>
          <div className="section-card"><strong>Period</strong><div>{draft.billing_period_start ?? '-'} to {draft.billing_period_end ?? '-'}</div></div>
          <div className="section-card"><strong>Total Qty</strong><div>{formatNumber(draft.total_qty)}</div></div>
          <div className="section-card"><strong>Total Chargeable Weight</strong><div>{formatNumber(draft.total_chargeable_weight)}</div></div>
          <div className="section-card"><strong>Total Amount</strong><div>{draft.total_amount == null ? '-' : formatNumber(draft.total_amount)} {draft.currency}</div></div>
          <div className="section-card"><strong>Created At</strong><div>{formatDate(draft.created_at)}</div></div>
          <div className="section-card"><strong>Note</strong><div>{draft.note ?? '-'}</div></div>
          <div className="section-card"><strong>Internal Reference</strong><div>{draft.internal_reference ?? '-'}</div></div>
          {draft.status === 'CANCELLED' ? (
            <>
              <div className="section-card"><strong>Cancelled At</strong><div>{formatDate(draft.cancelled_at)}</div></div>
              <div className="section-card"><strong>Cancel Reason</strong><div>{draft.cancel_reason ?? '-'}</div></div>
            </>
          ) : null}
        </div>
      </DashboardSection>

      <DashboardSection title="Draft Lines">
        <InvoiceDraftLinesTable lines={state.lines} />
      </DashboardSection>

      <InvoiceDraftBplusReadinessPanel
        draft={draft}
        readiness={readiness}
        loading={readinessLoading}
        error={readinessError}
        onPreview={handlePreviewBplusReadiness}
      />

      <UatOnly>
      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginTop: 16 }}>
        <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Gate 3B-4 boundary</h3>
        <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>Bplus export readiness preview only</li>
          <li>No executable Export Bplus action</li>
          <li>No Mark BILLED</li>
          <li>No tax invoice / AR module</li>
        </ul>
      </section>
      </UatOnly>

      <ReportPreviewModal
        open={printOpen}
        title={`Invoice Draft — ${draft.draft_no ?? ''}`}
        orientation="landscape"
        onClose={() => setPrintOpen(false)}
      >
        <InvoiceDraftPrintTemplate draft={draft} lines={state.lines} />
      </ReportPreviewModal>
    </section>
  );
}
