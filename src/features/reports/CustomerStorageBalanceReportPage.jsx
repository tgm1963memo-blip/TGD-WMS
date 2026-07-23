import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { CustomerStorageBalanceTable } from '../../components/reports/CustomerStorageBalanceTable.jsx';
import { CustomerStorageSummaryCard } from '../../components/reports/CustomerStorageSummaryCard.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { formatFixed2 } from '../../utils/numberFormat.js';
import {
  getCustomerStorageBalanceRows,
  getCustomerStorageBalanceSummary,
  getStorageBalanceByCustomer,
  getStorageBalanceByLot,
} from '../../services/customerStorageBalanceReportService.js';

const initialState = {
  rows: [],
  summary: null,
  customerSummary: [],
  lotSummary: [],
  loading: true,
  error: null,
};

function SummaryTable({ data = [], loading, error, label }) {
  if (loading) return <p className="sprint-status">Loading {label} summary...</p>;
  if (error) return <p className="sprint-status">Unable to load {label} summary.</p>;
  if (!data.length) return <p className="sprint-status">No {label} summary rows found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Stock Qty (Boxes)</th>
          <th>Stock Weight (kg)</th>
          <th>Rows</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.group_id}</td>
            <td>{row.qty_boxes.toLocaleString()}</td>
            <td>{formatFixed2(row.qty_weight)}</td>
            <td>{row.row_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CustomerStorageBalanceReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getCustomerStorageBalanceRows(filters),
      getCustomerStorageBalanceSummary(filters),
      getStorageBalanceByCustomer(filters),
      getStorageBalanceByLot(filters),
    ]).then(([rowsResult, summaryResult, customerResult, lotResult]) => {
      if (!isMounted) return;

      const error = rowsResult.error
        ?? summaryResult.error
        ?? customerResult.error
        ?? lotResult.error
        ?? null;

      setState({
        rows: rowsResult.data ?? [],
        summary: summaryResult.data,
        customerSummary: customerResult.data ?? [],
        lotSummary: lotResult.data ?? [],
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
        title="Customer Storage Balance Report"
        description="Read-only cold storage report for customer-owned inventory — computed live from confirmed deposits and completed withdrawals, same figures as ยอดคงเหลือ."
      />
      <ReportFilterPanel onChange={setFilters} showLotNo />

      <DashboardSection title="Customer-Owned Inventory Summary">
        <div className="summary-grid">
          <CustomerStorageSummaryCard label="Total Customers" value={state.summary?.customer_count} />
          <CustomerStorageSummaryCard label="Total Products / SKUs" value={state.summary?.product_count} />
          <CustomerStorageSummaryCard label="Total Lots" value={state.summary?.lot_count} />
          <CustomerStorageSummaryCard label="Total Stock Qty (Boxes)" value={state.summary?.qty_boxes?.toLocaleString()} />
          <CustomerStorageSummaryCard label="Total Stock Weight (kg)" value={formatFixed2(state.summary?.qty_weight ?? 0)} />
        </div>
      </DashboardSection>

      <DashboardSection title="Customer Storage Balance Table">
        <CustomerStorageBalanceTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Customer Summary">
        <SummaryTable data={state.customerSummary} loading={state.loading} error={state.error} label="Customer" />
      </DashboardSection>

      <DashboardSection title="Lot Summary">
        <SummaryTable data={state.lotSummary} loading={state.loading} error={state.error} label="Lot" />
      </DashboardSection>
    </section>
  );
}
