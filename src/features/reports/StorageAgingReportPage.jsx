import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { AgingBucketSummary } from '../../components/reports/AgingBucketSummary.jsx';
import { ExpiryAlertTable } from '../../components/reports/ExpiryAlertTable.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { StorageAgingTable } from '../../components/reports/StorageAgingTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  getExpiryAlertRows,
  getStorageAgingRows,
  getStorageAgingSummary,
  groupAgingByCustomer,
  groupAgingByWarehouse,
} from '../../services/storageAgingReportService.js';

const initialState = {
  rows: [],
  summary: null,
  expiryAlerts: [],
  customerSummary: [],
  warehouseSummary: [],
  loading: true,
  error: null,
};

export function StorageAgingReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getStorageAgingRows(filters),
      getStorageAgingSummary(filters),
      getExpiryAlertRows(filters),
    ]).then(([rowsResult, summaryResult, expiryResult]) => {
      if (!isMounted) return;

      const rows = rowsResult.data ?? [];
      const error = rowsResult.error ?? summaryResult.error ?? expiryResult.error ?? null;

      setState({
        rows,
        summary: summaryResult.data,
        expiryAlerts: expiryResult.data ?? [],
        customerSummary: groupAgingByCustomer(rows),
        warehouseSummary: groupAgingByWarehouse(rows),
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
        title="Storage Aging / Lot / Expiry / Chargeable Days Report"
        description="Read-only cold storage report for customer-owned inventory aging, expiry monitoring, and monthly storage billing preparation."
      />
      <ReportFilterPanel onChange={setFilters} />

      <DashboardSection title="Storage Aging Summary">
        <div className="summary-grid">
          <ReportSummaryCard label="Total Lots" value={state.summary?.total_lots} />
          <ReportSummaryCard label="Total Pallets" value={state.summary?.total_pallets} />
          <ReportSummaryCard label="Total Customers" value={state.summary?.total_customers} />
          <ReportSummaryCard label="Total Stock Qty" value={state.summary?.total_stock_qty} />
          <ReportSummaryCard label="Aging 0-30 Days" value={state.summary?.aging_0_30} />
          <ReportSummaryCard label="Aging 31-60 Days" value={state.summary?.aging_31_60} />
          <ReportSummaryCard label="Aging 61-90 Days" value={state.summary?.aging_61_90} />
          <ReportSummaryCard label="Aging Over 90 Days" value={state.summary?.aging_over_90} />
          <ReportSummaryCard label="Near Expiry Lots" value={state.summary?.near_expiry_lots} />
          <ReportSummaryCard label="Expired Lots" value={state.summary?.expired_lots} />
          <ReportSummaryCard
            label="Estimated Chargeable Days"
            value={state.summary?.estimated_chargeable_days}
            helperText="Placeholder for storage duration billing preparation"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Storage Aging Table">
        <StorageAgingTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Expiry Alert Section">
        <ExpiryAlertTable data={state.expiryAlerts} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Customer Aging Summary">
        <AgingBucketSummary data={state.customerSummary} loading={state.loading} error={state.error} label="Customer" />
      </DashboardSection>

      <DashboardSection title="Warehouse Aging Summary">
        <AgingBucketSummary data={state.warehouseSummary} loading={state.loading} error={state.error} label="Warehouse" />
      </DashboardSection>
    </section>
  );
}
