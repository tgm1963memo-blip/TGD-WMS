import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { StagingBoundaryNote } from '../../components/reports/StagingBoundaryNote.jsx';
import { AccountingChargeStagingSummaryCard } from '../../components/reports/AccountingChargeStagingSummaryCard.jsx';
import { CanonicalChargePayloadTable } from '../../components/reports/CanonicalChargePayloadTable.jsx';
import { BplusDraftPayloadTable } from '../../components/reports/BplusDraftPayloadTable.jsx';
import { AccountingChargeWarningPanel } from '../../components/reports/AccountingChargeWarningPanel.jsx';
import { getAccountingChargeStagingPreview } from '../../services/accountingChargeStagingPreviewService.js';

const currentDate = new Date();

const initialFilters = {
  month: String(currentDate.getMonth() + 1).padStart(2, '0'),
  year: String(currentDate.getFullYear()),
  customerId: '',
  warehouseId: '',
  targetAdapter: 'Bplus', // Defaults to Bplus and remains preview-only
};

const initialState = {
  previewData: null,
  loading: true,
  error: null,
};

export function AccountingChargeStagingPreviewPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState(initialState);
  const [activeTab, setActiveTab] = useState('canonical');
  const [localReviewNote, setLocalReviewNote] = useState('Draft reviewed in-memory. Data conforms to Bplus staging format.');

  const serviceFilters = useMemo(() => {
    // Maps to service preview expected filters format
    const dateFrom = `${filters.year}-${filters.month}-01`;
    const endDate = new Date(Number(filters.year), Number(filters.month), 0);
    const dateTo = `${filters.year}-${filters.month}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    return {
      dateFrom,
      dateTo,
      customerId: filters.customerId,
      warehouseId: filters.warehouseId,
      billingPeriod: `${filters.year}-${filters.month}`,
    };
  }, [filters]);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getAccountingChargeStagingPreview(serviceFilters)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setState({
            previewData: null,
            loading: false,
            error: res.error,
          });
        } else {
          setState({
            previewData: res.data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setState({
          previewData: null,
          loading: false,
          error: err.message || 'Failed to load staging preview data.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [serviceFilters]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  const summary = state.previewData?.summary || {
    total_staging_rows: 0,
    ready_rows: 0,
    warning_rows: 0,
    missing_customer_code_rows: 0,
    missing_billing_period_rows: 0,
    missing_service_code_rows: 0,
    missing_quantity_weight_rows: 0,
    requires_review_rows: 0,
  };

  const readinessStatus = state.previewData?.readiness_status || 'UNKNOWN';

  return (
    <section className="page-shell">
      <PageHeader
        title="Accounting Charge Staging Preview"
        description="Read-only staging area to review canonical charges and Bplus draft mappings before future external handoffs."
      />

      <section className="document-filter-bar" aria-label="Staging preview filters">
        <label>
          Month
          <input name="month" type="number" min="1" max="12" value={filters.month} onChange={updateFilter} />
        </label>
        <label>
          Year
          <input name="year" type="number" min="2020" value={filters.year} onChange={updateFilter} />
        </label>
        <label>
          Customer
          <input name="customerId" value={filters.customerId} onChange={updateFilter} placeholder="Customer ID" />
        </label>
        <label>
          Warehouse
          <input name="warehouseId" value={filters.warehouseId} onChange={updateFilter} placeholder="Warehouse ID" />
        </label>
        <label>
          Target Adapter
          <select name="targetAdapter" value={filters.targetAdapter} disabled onChange={updateFilter} style={{ opacity: 0.85, cursor: 'not-allowed' }}>
            <option value="Bplus">Bplus Accounting Charge Summary Adapter (Preview Only)</option>
            <option value="InforM3">Infor ERP M3 Summary Adapter (Future Target)</option>
          </select>
        </label>
      </section>

      <DashboardSection title="Staging Summary Dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>
          <div>
            <strong>Readiness Status: </strong>
            <span style={{
              fontWeight: 'bold',
              color: readinessStatus === 'READY_FOR_ACCOUNTING_REVIEW' ? '#5cb85c' : '#d9534f',
              backgroundColor: readinessStatus === 'READY_FOR_ACCOUNTING_REVIEW' ? 'rgba(92, 184, 92, 0.1)' : 'rgba(217, 83, 79, 0.1)',
              padding: '0.25rem 0.5rem',
              borderRadius: '3px',
              fontSize: '0.9rem'
            }}>
              {readinessStatus}
            </span>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            System Context: Offline Mock Staging
          </span>
        </div>

        <div className="summary-grid">
          <AccountingChargeStagingSummaryCard label="Total Staging Rows" value={summary.total_staging_rows} />
          <AccountingChargeStagingSummaryCard label="Ready Rows" value={summary.ready_rows} />
          <AccountingChargeStagingSummaryCard label="Warning Rows" value={summary.warning_rows} isWarning={summary.warning_rows > 0} />
          <AccountingChargeStagingSummaryCard label="Missing Customer Code" value={summary.missing_customer_code_rows} isWarning={summary.missing_customer_code_rows > 0} />
          <AccountingChargeStagingSummaryCard label="Missing Billing Period" value={summary.missing_billing_period_rows} isWarning={summary.missing_billing_period_rows > 0} />
          <AccountingChargeStagingSummaryCard label="Missing Service Code" value={summary.missing_service_code_rows} isWarning={summary.missing_service_code_rows > 0} />
          <AccountingChargeStagingSummaryCard label="Missing Qty / Weight" value={summary.missing_quantity_weight_rows} isWarning={summary.missing_quantity_weight_rows > 0} />
          <AccountingChargeStagingSummaryCard label="Requires Review Rows" value={summary.requires_review_rows} isWarning={summary.requires_review_rows > 0} />
        </div>
      </DashboardSection>

      <StagingBoundaryNote />

      <section className="document-section" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setActiveTab('canonical')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: activeTab === 'canonical' ? '#0275d8' : '#e6e6e6',
              color: activeTab === 'canonical' ? '#fff' : '#333',
            }}
          >
            Inspect Canonical Charges
          </button>
          <button
            onClick={() => setActiveTab('bplus')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: activeTab === 'bplus' ? '#0275d8' : '#e6e6e6',
              color: activeTab === 'bplus' ? '#fff' : '#333',
            }}
          >
            Inspect Bplus Draft Mapping
          </button>
          <button
            onClick={() => setActiveTab('warnings')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: activeTab === 'warnings' ? '#0275d8' : '#e6e6e6',
              color: activeTab === 'warnings' ? '#fff' : '#333',
            }}
          >
            Inspect Validation Logs
          </button>
        </div>

        {activeTab === 'canonical' && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Canonical Accounting Charge Summary rows</h4>
            <CanonicalChargePayloadTable
              data={state.previewData?.canonical_payload?.rows || []}
              loading={state.loading}
              error={state.error}
            />
          </div>
        )}

        {activeTab === 'bplus' && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Mapped Bplus Draft Preview Rows</h4>
            <BplusDraftPayloadTable
              data={state.previewData?.bplus_draft_payload?.rows || []}
              loading={state.loading}
              error={state.error}
            />
          </div>
        )}

        {activeTab === 'warnings' && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Validation Warning & Readiness Log</h4>
            <AccountingChargeWarningPanel
              errors={state.previewData?.validation_errors || []}
              warnings={state.previewData?.validation_warnings || []}
              loading={state.loading}
              error={state.error}
            />
          </div>
        )}
      </section>

      <section className="document-section" style={{ marginTop: '1.5rem' }}>
        <h3>Staging Review Work Notes</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
          Operators can draft staging comments below for temporary in-memory verification. No database writes or file exports occur.
        </p>
        <textarea
          rows={3}
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }}
          value={localReviewNote}
          onChange={(e) => setLocalReviewNote(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            onClick={() => alert('Temporary review note validated in-memory!')}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#5bc0de',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Validate Local Review Comment
          </button>
        </div>
      </section>
    </section>
  );
}
