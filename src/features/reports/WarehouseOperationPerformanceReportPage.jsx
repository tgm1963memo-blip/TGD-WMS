import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { OperationStatusBreakdown } from '../../components/reports/OperationStatusBreakdown.jsx';
import { OperationVolumeSummary } from '../../components/reports/OperationVolumeSummary.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { WarehouseOperationPerformanceTable } from '../../components/reports/WarehouseOperationPerformanceTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  getOperationChargeActivityPreview,
  getOperationPerformanceRows,
  getOperationPerformanceSummary,
  getOperationStatusBreakdown,
  getOperationVolumeByCustomer,
  getOperationVolumeByWarehouse,
} from '../../services/warehouseOperationPerformanceService.js';

const initialState = {
  rows: [],
  summary: null,
  statusBreakdown: [],
  customerVolume: [],
  warehouseVolume: [],
  chargeActivity: [],
  loading: true,
  error: null,
};

export function WarehouseOperationPerformanceReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getOperationPerformanceRows(filters),
      getOperationPerformanceSummary(filters),
      getOperationStatusBreakdown(filters),
      getOperationVolumeByCustomer(filters),
      getOperationVolumeByWarehouse(filters),
      getOperationChargeActivityPreview(filters),
    ]).then(([rowsResult, summaryResult, statusResult, customerResult, warehouseResult, chargeResult]) => {
      if (!isMounted) return;

      const error = rowsResult.error
        ?? summaryResult.error
        ?? statusResult.error
        ?? customerResult.error
        ?? warehouseResult.error
        ?? chargeResult.error
        ?? null;

      setState({
        rows: rowsResult.data ?? [],
        summary: summaryResult.data,
        statusBreakdown: statusResult.data ?? [],
        customerVolume: customerResult.data ?? [],
        warehouseVolume: warehouseResult.data ?? [],
        chargeActivity: chargeResult.data ?? [],
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
      <PageHeader
        title="Warehouse Operation Performance Report"
        description="Read-only cold storage warehouse operation workload report for customer-owned inventory and monthly storage billing preparation."
      />
      <ReportFilterPanel onChange={setFilters} />

      <DashboardSection title="Warehouse Operation Summary">
        <div className="summary-grid">
          <ReportSummaryCard label="Total Operations" value={state.summary?.total_operations} />
          <ReportSummaryCard label="Receiving Count" value={state.summary?.receiving_count} />
          <ReportSummaryCard label="Putaway Count" value={state.summary?.putaway_count} />
          <ReportSummaryCard label="Transfer Count" value={state.summary?.transfer_count} />
          <ReportSummaryCard label="Adjustment Count" value={state.summary?.adjustment_count} />
          <ReportSummaryCard label="Withdrawal Request Count" value={state.summary?.withdrawal_request_count} />
          <ReportSummaryCard label="Picking Count" value={state.summary?.picking_count} />
          <ReportSummaryCard label="Dispatch Count" value={state.summary?.dispatch_count} />
          <ReportSummaryCard label="Pending Operations" value={state.summary?.pending_operations} />
          <ReportSummaryCard label="Completed Operations" value={state.summary?.completed_operations} />
          <ReportSummaryCard
            label="Operation Charge Activity Count"
            value={state.chargeActivity.length || state.summary?.operation_charge_activity_count}
            helperText="Preview count for lifting, repack, sorting, labeling, and palletizing work"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Operation Performance Table">
        <WarehouseOperationPerformanceTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Operation Status Breakdown">
        <OperationStatusBreakdown data={state.statusBreakdown} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Customer Operation Volume">
        <OperationVolumeSummary data={state.customerVolume} loading={state.loading} error={state.error} label="Customer" />
      </DashboardSection>

      <DashboardSection title="Warehouse Operation Volume">
        <OperationVolumeSummary data={state.warehouseVolume} loading={state.loading} error={state.error} label="Warehouse" />
      </DashboardSection>

      <DashboardSection title="Operation Charge Activity Preview">
        <WarehouseOperationPerformanceTable data={state.chargeActivity} loading={state.loading} error={state.error} />
      </DashboardSection>
    </section>
  );
}
