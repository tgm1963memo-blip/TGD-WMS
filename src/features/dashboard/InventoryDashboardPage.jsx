import { useEffect, useState } from 'react';
import { DashboardCard } from '../../components/dashboard/DashboardCard.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { InventorySummaryTable } from '../../components/dashboard/InventorySummaryTable.jsx';
import { DocumentFilterBar } from '../../components/operations/DocumentFilterBar.jsx';
import { QuantitySummaryCard } from '../../components/operations/QuantitySummaryCard.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  getExpiringLots,
  getInventoryByCustomer,
  getInventoryByWarehouse,
  getInventorySummary,
  getLowStockItems,
  getStockBalanceRows,
} from '../../services/inventoryDashboardService.js';

const stockColumns = [
  { key: 'customer_id', header: 'Customer' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'location_id', header: 'Location' },
  { key: 'pallet_id', header: 'Pallet' },
  { key: 'qty_on_hand', header: 'On Hand' },
  { key: 'qty_allocated', header: 'Allocated' },
  { key: 'qty_available', header: 'Available' },
];

const lotColumns = [
  { key: 'lot_no', header: 'Lot No' },
  { key: 'product_id', header: 'Product' },
  { key: 'exp_date', header: 'Expiry Date' },
  { key: 'received_date', header: 'Received Date' },
];

const initialState = {
  summary: null,
  stockRows: [],
  lowStock: [],
  expiringLots: [],
  byWarehouse: [],
  byCustomer: [],
  loading: true,
  error: null,
};

export function InventoryDashboardPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getInventorySummary(filters),
      getStockBalanceRows(filters),
      getLowStockItems(filters),
      getExpiringLots(filters),
      getInventoryByWarehouse(filters),
      getInventoryByCustomer(filters),
    ]).then(([
      summaryResult,
      stockResult,
      lowStockResult,
      expiringLotResult,
      warehouseResult,
      customerResult,
    ]) => {
      if (!isMounted) return;

      const error = summaryResult.error
        ?? stockResult.error
        ?? lowStockResult.error
        ?? expiringLotResult.error
        ?? warehouseResult.error
        ?? customerResult.error
        ?? null;

      setState({
        summary: summaryResult.data,
        stockRows: stockResult.data ?? [],
        lowStock: lowStockResult.data ?? [],
        expiringLots: expiringLotResult.data ?? [],
        byWarehouse: warehouseResult.data ?? [],
        byCustomer: customerResult.data ?? [],
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
      <PageHeader title="Inventory Dashboard" description="Read-only inventory balance overview." />
      <DocumentFilterBar onChange={setFilters} />

      <DashboardSection title="Inventory Summary">
        <div className="summary-grid">
          <DashboardCard label="Total Stock Qty" value={state.summary?.totalStockQty} />
          <DashboardCard label="Total Allocated Qty" value={state.summary?.totalAllocatedQty} />
          <DashboardCard label="Available Qty" value={state.summary?.availableQty} />
          <QuantitySummaryCard label="SKUs" value={state.summary?.skuCount} helperText="Distinct products with balance rows." />
          <QuantitySummaryCard label="Lots" value={state.summary?.lotCount} helperText="Distinct active lots in balance rows." />
          <QuantitySummaryCard label="Pallets" value={state.summary?.palletCount} helperText="Distinct pallets in balance rows." />
        </div>
      </DashboardSection>

      <DashboardSection title="Stock Balances">
        <DataTable columns={stockColumns} data={state.stockRows} loading={state.loading} error={state.error} emptyMessage="No stock balances found." />
      </DashboardSection>

      <DashboardSection title="Low Stock">
        <DataTable columns={stockColumns} data={state.lowStock} loading={state.loading} error={state.error} emptyMessage="No low stock items found." />
      </DashboardSection>

      <DashboardSection title="Expiring Lots">
        <DataTable columns={lotColumns} data={state.expiringLots} loading={state.loading} error={state.error} emptyMessage="No expiring lots found." />
      </DashboardSection>

      <DashboardSection title="Inventory By Warehouse">
        <InventorySummaryTable data={state.byWarehouse} loading={state.loading} error={state.error} emptyMessage="No warehouse inventory summary found." />
      </DashboardSection>

      <DashboardSection title="Inventory By Customer">
        <InventorySummaryTable data={state.byCustomer} loading={state.loading} error={state.error} emptyMessage="No customer inventory summary found." />
      </DashboardSection>
    </section>
  );
}
