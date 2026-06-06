import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { MovementLedgerTable } from '../../components/reports/MovementLedgerTable.jsx';
import { MovementTypeBreakdown } from '../../components/reports/MovementTypeBreakdown.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import {
  getMovementLedgerRows,
  getMovementLedgerSummary,
  getMovementTypeBreakdown,
} from '../../services/movementLedgerReportService.js';

const initialState = {
  rows: [],
  summary: null,
  breakdown: [],
  loading: true,
  error: null,
};

export function MovementLedgerReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getMovementLedgerRows(filters),
      getMovementLedgerSummary(filters),
      getMovementTypeBreakdown(filters),
    ]).then(([rowsResult, summaryResult, breakdownResult]) => {
      if (!isMounted) return;

      const error = rowsResult.error ?? summaryResult.error ?? breakdownResult.error ?? null;

      setState({
        rows: rowsResult.data ?? [],
        summary: summaryResult.data,
        breakdown: breakdownResult.data ?? [],
        loading: false,
        error,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters]);

  return (
    <section className="page-shell">
      <PageHeader title="Customer Stock Movement Ledger" description="Read-only cold storage movement report for operations and audit preparation." />
      <ReportFilterPanel onChange={setFilters} />

      <DashboardSection title="Customer Stock Movement Summary">
        <div className="summary-grid">
          <ReportSummaryCard label="Deposit / Inbound Qty" value={state.summary?.totalInboundQty} />
          <ReportSummaryCard label="Withdrawal / Outbound Qty" value={state.summary?.totalOutboundQty} />
          <ReportSummaryCard label="Net Stock Movement" value={state.summary?.netMovementQty} />
          <ReportSummaryCard label="Total Movement Rows" value={state.summary?.totalMovementRows} />
          <ReportSummaryCard label="Unique Customers" value={state.summary?.uniqueCustomers} />
          <ReportSummaryCard label="Unique Lots" value={state.summary?.uniqueLots} />
          <ReportSummaryCard label="Unique Pallets" value={state.summary?.uniquePallets} />
        </div>
      </DashboardSection>

      <DashboardSection title="Movement Type Breakdown">
        <MovementTypeBreakdown data={state.breakdown} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Movement Ledger">
        <MovementLedgerTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
        <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
        <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>No Production migration applied</li>
          <li>UI polish does not change stock movement behavior</li>
          <li>UI polish does not change stock balance calculation</li>
          <li>Existing services and RPC calls are unchanged</li>
        </ul>
      </section>
    </section>
  );
}
