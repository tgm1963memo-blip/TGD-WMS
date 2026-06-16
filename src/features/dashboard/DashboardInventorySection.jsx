import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { DocumentFilterBar } from '../../components/operations/DocumentFilterBar.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import {
  getExpiringLots,
  getInventoryByCustomer,
  getInventoryByWarehouse,
  getInventorySummary,
  getLowStockItems,
  getStockBalanceRows,
} from '../../services/inventoryDashboardService.js';

const stockColumns = [
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'location_id', header: 'Location' },
  { key: 'qty_on_hand', header: 'Qty', render: (row) => <span style={{ fontWeight: 600 }}>{row.qty_on_hand}</span> },
  { key: 'weight', header: 'Weight', render: () => <span style={{ color: 'var(--tgd-muted-text)' }}>-</span> },
  { key: 'qty_allocated', header: 'Reserved', render: (row) => <span style={{ color: 'var(--tgd-warning)', fontWeight: 600 }}>{row.qty_allocated}</span> },
  { key: 'qty_available', header: 'Available', render: (row) => <span style={{ color: 'var(--tgd-info)', fontWeight: 600 }}>{row.qty_available}</span> },
  { key: 'status', header: 'Status', render: (row) => (
    <StatusBadge value={row.qty_allocated > 0 ? 'Reserved' : 'Available'} />
  )},
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

export function DashboardInventorySection() {
  const t = useTranslation();
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
    <div id="inventory" data-testid="dashboard-inventory-section">
      <DashboardSection title={t('dashboard_inventory_section_title') || 'Inventory Overview'}>
        <div className="operations-filter-card">
          <DocumentFilterBar onChange={setFilters} />
        </div>

        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card info">
            <h3 className="kpi-label">{t('total_stock_qty')}</h3>
            <div className="kpi-value">{state.summary?.totalStockQty ?? 0}</div>
            <div className="kpi-helper">{t('stock_balance')}</div>
          </div>
          <div className="kpi-card warning">
            <h3 className="kpi-label">{t('reserved_quantity') || 'Reserved Quantity'}</h3>
            <div className="kpi-value">{state.summary?.totalAllocatedQty ?? 0}</div>
            <div className="kpi-helper">{t('dispatch')}</div>
          </div>
          <div className="kpi-card success">
            <h3 className="kpi-label">{t('total_weight') || 'Total Weight'}</h3>
            <div className="kpi-value">-</div>
            <div className="kpi-helper">kg</div>
          </div>
          <div className="kpi-card info">
            <h3 className="kpi-label">{t('active_lots') || 'Active Lots'}</h3>
            <div className="kpi-value">{state.summary?.lotCount ?? 0}</div>
            <div className="kpi-helper">{t('lot_pallet') || 'Lot / Pallet'}</div>
          </div>
        </div>

        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3 className="section-card-title">{t('stock_balances') || 'Stock Balances'}</h3>
          <DataTable
            columns={stockColumns}
            data={state.stockRows}
            loading={state.loading}
            error={state.error}
            emptyMessage={t('no_stock_balances') || 'No stock balances found.'}
          />
        </div>

        <div className="dashboard-grid-2col" style={{ marginBottom: 24 }}>
          <div className="section-card">
            <h3 className="section-card-title">{t('low_stock') || 'Low Stock'}</h3>
            <DataTable columns={stockColumns} data={state.lowStock} loading={state.loading} error={state.error} emptyMessage={t('no_low_stock') || 'No low stock items found.'} />
          </div>
          <div className="section-card">
            <h3 className="section-card-title">{t('expiring_lots') || 'Expiring Lots'}</h3>
            <DataTable columns={lotColumns} data={state.expiringLots} loading={state.loading} error={state.error} emptyMessage={t('no_expiring_lots') || 'No expiring lots found.'} />
          </div>
        </div>

        <div className="dashboard-grid-2col">
          <div className="section-card">
            <h3 className="section-card-title">{t('inventory_by_warehouse') || 'Inventory By Warehouse'}</h3>
            <DataTable columns={stockColumns} data={state.byWarehouse} loading={state.loading} error={state.error} emptyMessage={t('no_warehouse_inventory') || 'No warehouse data found.'} />
          </div>
          <div className="section-card">
            <h3 className="section-card-title">{t('inventory_by_customer') || 'Inventory By Customer'}</h3>
            <DataTable columns={stockColumns} data={state.byCustomer} loading={state.loading} error={state.error} emptyMessage={t('no_customer_inventory') || 'No customer data found.'} />
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
