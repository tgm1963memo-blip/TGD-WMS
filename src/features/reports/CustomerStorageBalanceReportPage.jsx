import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { CustomerStorageBalanceTable } from '../../components/reports/CustomerStorageBalanceTable.jsx';
import { CustomerStorageSummaryCard } from '../../components/reports/CustomerStorageSummaryCard.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  getCustomerStorageBalanceRows,
  getCustomerStorageBalanceSummary,
  getStorageBalanceByCustomer,
  getStorageBalanceByLot,
  getStorageBalanceByWarehouse,
} from '../../services/customerStorageBalanceReportService.js';

const initialState = {
  rows: [],
  summary: null,
  customerSummary: [],
  warehouseSummary: [],
  lotSummary: [],
  loading: true,
  error: null,
};

function estimateChargeableQty(summary) {
  return Number(summary?.qty_on_hand ?? 0);
}

function SummaryTable({ data = [], loading, error, label }) {
  if (loading) return <p className="sprint-status">Loading {label} summary...</p>;
  if (error) return <p className="sprint-status">Unable to load {label} summary.</p>;
  if (!data.length) return <p className="sprint-status">No {label} summary rows found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Stock Qty</th>
          <th>Allocated Qty</th>
          <th>Available Qty</th>
          <th>Rows</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.group_id}</td>
            <td>{row.qty_on_hand}</td>
            <td>{row.qty_allocated}</td>
            <td>{row.qty_available}</td>
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
      getStorageBalanceByWarehouse(filters),
      getStorageBalanceByLot(filters),
    ]).then(([rowsResult, summaryResult, customerResult, warehouseResult, lotResult]) => {
      if (!isMounted) return;

      const error = rowsResult.error
        ?? summaryResult.error
        ?? customerResult.error
        ?? warehouseResult.error
        ?? lotResult.error
        ?? null;

      setState({
        rows: rowsResult.data ?? [],
        summary: summaryResult.data,
        customerSummary: customerResult.data ?? [],
        warehouseSummary: warehouseResult.data ?? [],
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
        description="Read-only cold storage report for customer-owned inventory and monthly storage billing preparation."
      />
      <ReportFilterPanel onChange={setFilters} />

      <DashboardSection title="Customer-Owned Inventory Summary">
        <div className="summary-grid">
          <CustomerStorageSummaryCard label="Total Customers" value={state.summary?.customer_count} />
          <CustomerStorageSummaryCard label="Total Products / SKUs" value={state.summary?.product_count} />
          <CustomerStorageSummaryCard label="Total Lots" value={state.summary?.lot_count} />
          <CustomerStorageSummaryCard label="Total Pallets" value={state.summary?.pallet_count} />
          <CustomerStorageSummaryCard label="Total Stock Qty" value={state.summary?.qty_on_hand} />
          <CustomerStorageSummaryCard label="Total Available Qty" value={state.summary?.qty_available} />
          <CustomerStorageSummaryCard label="Total Allocated Qty" value={state.summary?.qty_allocated} />
          <CustomerStorageSummaryCard
            label="Estimated Chargeable Qty / Weight"
            value={estimateChargeableQty(state.summary)}
            helperText="Placeholder for monthly storage billing preparation"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Customer Storage Balance Table">
        <CustomerStorageBalanceTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Customer Summary">
        <SummaryTable data={state.customerSummary} loading={state.loading} error={state.error} label="Customer" />
      </DashboardSection>

      <DashboardSection title="Warehouse Summary">
        <SummaryTable data={state.warehouseSummary} loading={state.loading} error={state.error} label="Warehouse" />
      </DashboardSection>

      <DashboardSection title="Lot / Pallet Summary">
        <SummaryTable data={state.lotSummary} loading={state.loading} error={state.error} label="Lot / Pallet" />
      </DashboardSection>
    </section>
  );
}
