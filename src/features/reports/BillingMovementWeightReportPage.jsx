import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { BillingMovementWeightFilterPanel } from '../../components/reports/BillingMovementWeightFilterPanel.jsx';
import { BillingMovementWeightTable } from '../../components/reports/BillingMovementWeightTable.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { getBillingMovementWeightRows } from '../../services/billingMovementWeightService.js';
import {
  createBillingInvoiceDraftFromMovements,
  findActiveDuplicateDraftLines,
} from '../../services/billingInvoiceDraftService.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
import {
  applyActiveDuplicateDraftGuards,
  formatInvoiceDraftError,
  getMovementDraftSelectionState,
  validateInvoiceDraftSourceRows,
} from '../../utils/billingInvoiceDraftUtils.js';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { canWriteBillingInvoiceDrafts } from '../../security/billingInvoiceDraftPermissions.js';
import {
  calculateBillingMovementWeightSummary,
  classifyBillingMovementWeightError,
  downloadBillingMovementWeightCsv,
} from '../../utils/billingMovementWeightReportUtils.js';

const initialState = {
  rows: [],
  loading: true,
  error: null,
  source: null,
};

export function BillingMovementWeightReportPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { role: userRole, ready: roleReady } = useUserRole();
  const goLive = isGoLivePresentationEnabled();
  const canCreateDraft = roleReady && canWriteBillingInvoiceDrafts(userRole);
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedMovementIds, setSelectedMovementIds] = useState(() => new Set());
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftValidationError, setDraftValidationError] = useState(null);
  const [draftSuccess, setDraftSuccess] = useState(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getCustomers(), getProducts()]).then(([customerResult, productResult]) => {
      if (!isMounted) return;
      setCustomers(customerResult.data ?? []);
      setProducts(productResult.data ?? []);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getBillingMovementWeightRows(filters).then(async (result) => {
      if (!isMounted) return;

      if (result.error) {
        setState({
          rows: [],
          loading: false,
          error: result.error,
          source: result.source ?? null,
        });
        return;
      }

      const rows = result.data ?? [];
      let guardedRows = rows;

      if (canCreateDraft) {
        const movementIds = rows.map((row) => row.movement_id).filter(Boolean);
        const duplicateResult = await findActiveDuplicateDraftLines(movementIds);
        if (!isMounted) return;

        if (duplicateResult.error) {
          setState({
            rows: [],
            loading: false,
            error: duplicateResult.error,
            source: result.source ?? null,
          });
          return;
        }

        guardedRows = applyActiveDuplicateDraftGuards(rows, duplicateResult.data ?? []);
      }

      setState({
        rows: guardedRows,
        loading: false,
        error: null,
        source: result.source ?? null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [canCreateDraft, filters]);

  useEffect(() => {
    setSelectedMovementIds(new Set());
    setDraftValidationError(null);
    setDraftSuccess(null);
  }, [filters, state.rows]);

  const selectedRows = useMemo(
    () => state.rows.filter((row) => selectedMovementIds.has(String(row.movement_id))),
    [state.rows, selectedMovementIds],
  );

  const summary = useMemo(
    () => calculateBillingMovementWeightSummary(state.rows),
    [state.rows],
  );

  const classifiedError = state.error ? classifyBillingMovementWeightError(state.error) : null;

  const emptyMessage = state.loading
    ? null
    : classifiedError
      ? null
      : 'No billing movement weight rows match the selected filters.';

  function handleExport() {
    if (!state.rows.length) return;
    downloadBillingMovementWeightCsv(state.rows);
  }

  function toggleRowSelection(movementId) {
    setDraftValidationError(null);
    setDraftSuccess(null);
    setSelectedMovementIds((current) => {
      const next = new Set(current);
      if (next.has(movementId)) next.delete(movementId);
      else next.add(movementId);
      return next;
    });
  }

  function toggleAllSelectable(movementIds = []) {
    setDraftValidationError(null);
    setDraftSuccess(null);
    setSelectedMovementIds((current) => {
      const allSelected = movementIds.every((id) => current.has(id));
      if (allSelected) return new Set();
      return new Set(movementIds);
    });
  }

  async function handleCreateDraft() {
    const movementIds = [...selectedMovementIds];
    const clientValidation = validateInvoiceDraftSourceRows(selectedRows);
    if (!clientValidation.valid) {
      setDraftValidationError(new Error(clientValidation.errors.join(' ')));
      setDraftSuccess(null);
      return;
    }

    setCreatingDraft(true);
    setDraftValidationError(null);
    setDraftSuccess(null);

    const result = await createBillingInvoiceDraftFromMovements({
      movementIds,
      note: 'E2E_TEST',
    });

    setCreatingDraft(false);

    if (result.error) {
      setDraftValidationError(result.error);
      return;
    }

    const draft = result.data?.draft;
    setDraftSuccess(draft);
    setSelectedMovementIds(new Set());

    if (draft?.id) {
      navigate(`/billing/invoice-drafts/${draft.id}`);
    }
  }

  if (!roleReady) {
    return (
      <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`} data-testid="billing-movement-weight-report-page">
        <LoadingState message="Loading permissions..." />
      </section>
    );
  }

  return (
    <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`} data-testid="billing-movement-weight-report-page">
      <PageHeader
        title={getTranslation('billing_movement_weight_report', language) || 'Billing Movement Weight Report'}
        description={goLive
          ? (getTranslation('billing_movement_weight_report_description_golive', language)
            || 'Movement weight and billable status for billing review and invoice draft preparation.')
          : (getTranslation('billing_movement_weight_report_description', language) || 'Read-only preview of movement weight and billable status before billing approval.')}
      />

      {!goLive ? (
        <div className="section-card" style={{ marginBottom: 16, padding: 12, background: '#fff8e8', border: '1px solid var(--tgd-primary-gold)' }}>
          <strong>Gate 3B-2 Billing Preview</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            Select READY_FOR_PREVIEW billable rows to create invoice drafts.
            No approve, no Bplus export, no Mark BILLED.
            NEEDS_WEIGHT_REVIEW rows remain review-only and cannot be selected.
          </p>
        </div>
      ) : null}

      <BillingMovementWeightFilterPanel
        value={filters}
        onChange={setFilters}
        customers={customers}
        products={products}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '12px 0', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--tgd-muted-text)' }}>
          Selected rows: {selectedMovementIds.size}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canCreateDraft ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateDraft}
              disabled={state.loading || creatingDraft || selectedMovementIds.size === 0}
              data-testid="create-invoice-draft-button"
            >
              {creatingDraft ? 'Creating Draft...' : 'Create Draft'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExport}
            disabled={state.loading || !state.rows.length}
            data-testid="billing-movement-weight-export-button"
          >
            Export CSV
          </button>
        </div>
      </div>

      {draftValidationError ? (
        <div
          className="section-card"
          role="alert"
          data-testid="invoice-draft-validation-alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
        >
          {formatInvoiceDraftError(draftValidationError)}
        </div>
      ) : null}

      {draftSuccess ? (
        <div
          className="section-card"
          role="status"
          data-testid="invoice-draft-success-alert"
          style={{ border: '1px solid #86efac', background: '#f0fdf4', padding: 16, marginBottom: 16 }}
        >
          Invoice draft <strong>{draftSuccess.draft_no}</strong> created.
          {draftSuccess.id ? (
            <>
              {' '}
              <Link to={`/billing/invoice-drafts/${draftSuccess.id}`}>View draft detail</Link>
            </>
          ) : null}
        </div>
      ) : null}

      {classifiedError ? (
        <div
          className="section-card"
          role="alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
          data-testid="billing-movement-weight-error-alert"
        >
          <strong>{classifiedError.title}</strong>
          <p style={{ margin: '8px 0 0' }}>{classifiedError.message}</p>
          {classifiedError.type === 'schema_cache' ? (
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Suggested UAT fix: reload PostgREST schema in Supabase Dashboard and grant SELECT on
              {' '}
              <code>tgd_billing_movement_weight_v</code>
              {' '}
              to authenticated/anon as approved.
            </p>
          ) : null}
        </div>
      ) : null}

      <DashboardSection title="Billing Movement Weight Summary">
        <div className="summary-grid">
          <ReportSummaryCard label="Total Movements" value={summary.totalMovements} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Billable Movements" value={summary.billableMovements} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Excluded Movements" value={summary.excludedMovements} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Total Qty" value={summary.totalQty} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Total Net Weight" value={summary.totalNetWeight} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Total Gross Weight" value={summary.totalGrossWeight} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Total Chargeable Weight" value={summary.totalChargeableWeight} testId="billing-movement-weight-summary-card" />
          <ReportSummaryCard label="Needs Weight Review" value={summary.needsWeightReviewCount} testId="billing-movement-weight-summary-card" />
        </div>
      </DashboardSection>

      <DashboardSection title="Billing Movement Weight Detail">
        <BillingMovementWeightTable
          data={state.rows}
          loading={state.loading}
          error={state.error}
          selectedMovementIds={selectedMovementIds}
          onToggleRow={canCreateDraft ? toggleRowSelection : null}
          onToggleAllSelectable={canCreateDraft ? toggleAllSelectable : null}
          getSelectionState={canCreateDraft ? getMovementDraftSelectionState : null}
          emptyState={(
            <div
              className="section-card"
              style={{ padding: 24, textAlign: 'center' }}
              data-testid="billing-movement-weight-empty-state"
            >
              <strong>{emptyMessage ?? 'Loading billing movement weight report...'}</strong>
              {!state.loading && !state.error && state.source === 'billing_database_view' && !goLive ? (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--tgd-muted-text)' }}>
                  Data source: UAT billing movement weight view.
                </p>
              ) : null}
            </div>
          )}
        />
      </DashboardSection>

      {!goLive ? (
        <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>Gate 3B-2 supports create/list/cancel invoice drafts only</li>
            <li>No approve / Bplus export / Mark BILLED</li>
            <li>No billing amount calculation when weight is incomplete</li>
            <li>FINAL GO is NOT AUTHORIZED</li>
          </ul>
        </section>
      ) : null}
    </section>
  );
}
