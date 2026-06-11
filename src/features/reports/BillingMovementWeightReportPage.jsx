import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { BillingMovementWeightFilterPanel } from '../../components/reports/BillingMovementWeightFilterPanel.jsx';
import { BillingMovementWeightTable } from '../../components/reports/BillingMovementWeightTable.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { getBillingMovementWeightRows } from '../../services/billingMovementWeightService.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
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
  const { language } = useLanguage();
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

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

    getBillingMovementWeightRows(filters).then((result) => {
      if (!isMounted) return;

      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
        source: result.source ?? null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters]);

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

  return (
    <section className="page-shell" data-testid="billing-movement-weight-report-page">
      <PageHeader
        title={getTranslation('billing_movement_weight_report', language) || 'Billing Movement Weight Report'}
        description={getTranslation('billing_movement_weight_report_description', language) || 'Read-only preview of movement weight and billable status before billing approval.'}
      />

      <div className="section-card" style={{ marginBottom: 16, padding: 12, background: '#fff8e8', border: '1px solid var(--tgd-primary-gold)' }}>
        <strong>Gate 3A Preview Only</strong>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          No billing draft workflow, no billing amount calculation, no BILLED lock, no Bplus export.
          NEEDS_WEIGHT_REVIEW rows are shown for manual review only.
        </p>
      </div>

      <BillingMovementWeightFilterPanel
        value={filters}
        onChange={setFilters}
        customers={customers}
        products={products}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '12px 0' }}>
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
          emptyState={(
            <div
              className="section-card"
              style={{ padding: 24, textAlign: 'center' }}
              data-testid="billing-movement-weight-empty-state"
            >
              <strong>{emptyMessage ?? 'Loading billing movement weight report...'}</strong>
              {!state.loading && !state.error && state.source === 'billing_database_view' ? (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--tgd-muted-text)' }}>
                  Data source: UAT billing movement weight view.
                </p>
              ) : null}
            </div>
          )}
        />
      </DashboardSection>

      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
        <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
        <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>Gate 3A is read-only preview only</li>
          <li>No billing draft workflow in this gate</li>
          <li>No billing amount calculation when weight is incomplete</li>
          <li>FINAL GO is NOT AUTHORIZED</li>
        </ul>
      </section>
    </section>
  );
}
