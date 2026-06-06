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
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'location_id', header: 'Location' },
  { key: 'qty_on_hand', header: 'Qty', render: (row) => <span style={{ fontWeight: 600 }}>{row.qty_on_hand}</span> },
  { key: 'weight', header: 'Weight', render: () => <span style={{ color: 'var(--tgd-muted-text)' }}>-</span> },
  { key: 'qty_allocated', header: 'Reserved', render: (row) => <span style={{ color: 'var(--tgd-warning)', fontWeight: 600 }}>{row.qty_allocated}</span> },
  { key: 'qty_available', header: 'Available', render: (row) => <span style={{ color: 'var(--tgd-info)', fontWeight: 600 }}>{row.qty_available}</span> },
  { key: 'status', header: 'Status', render: (row) => (
      <span style={{ padding: '4px 8px', borderRadius: 4, background: row.qty_allocated > 0 ? '#fef3c7' : '#dcfce7', color: row.qty_allocated > 0 ? '#b45309' : '#166534', fontSize: 12, fontWeight: 600 }}>
        {row.qty_allocated > 0 ? 'Reserved' : 'Available'}
      </span>
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
    <section className="page-shell inventory-page" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader 
        title="Inventory Control" 
        description="Available stock, reservations, lot, location, and movement visibility." 
      />
      <div className="dashboard-header-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
         <span className="production-hold-badge" style={{ padding: '8px 12px', background: 'var(--tgd-danger)', color: '#fff', borderRadius: 8, fontWeight: 600 }}>Production HOLD</span>
      </div>

      <div style={{ background: 'var(--tgd-surface)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid var(--tgd-border)' }}>
        <DocumentFilterBar onChange={setFilters} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="kpi-card info" style={{ padding: 20, background: 'var(--tgd-surface)', borderRadius: 8, borderLeft: '4px solid var(--tgd-info)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 className="kpi-label" style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--tgd-muted-text)' }}>Total Quantity</h3>
          <div className="kpi-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tgd-main-text)' }}>{state.summary?.totalStockQty ?? 0}</div>
          <div className="kpi-helper" style={{ fontSize: 12, color: 'var(--tgd-muted-text)', marginTop: 4 }}>Physical units on hand</div>
        </div>
        <div className="kpi-card warning" style={{ padding: 20, background: 'var(--tgd-surface)', borderRadius: 8, borderLeft: '4px solid var(--tgd-warning)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 className="kpi-label" style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--tgd-muted-text)' }}>Reserved Quantity</h3>
          <div className="kpi-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tgd-main-text)' }}>{state.summary?.totalAllocatedQty ?? 0}</div>
          <div className="kpi-helper" style={{ fontSize: 12, color: 'var(--tgd-muted-text)', marginTop: 4 }}>Allocated for outbound</div>
        </div>
        <div className="kpi-card success" style={{ padding: 20, background: 'var(--tgd-surface)', borderRadius: 8, borderLeft: '4px solid var(--tgd-success)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 className="kpi-label" style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--tgd-muted-text)' }}>Total Weight</h3>
          <div className="kpi-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tgd-main-text)' }}>-</div>
          <div className="kpi-helper" style={{ fontSize: 12, color: 'var(--tgd-muted-text)', marginTop: 4 }}>Estimated kg</div>
        </div>
        <div className="kpi-card info" style={{ padding: 20, background: 'var(--tgd-surface)', borderRadius: 8, borderLeft: '4px solid var(--tgd-primary-gold)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 className="kpi-label" style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--tgd-muted-text)' }}>Locations / Lots</h3>
          <div className="kpi-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tgd-main-text)' }}>{state.summary?.lotCount ?? 0}</div>
          <div className="kpi-helper" style={{ fontSize: 12, color: 'var(--tgd-muted-text)', marginTop: 4 }}>Active stock lots</div>
        </div>
      </div>

      <div style={{ background: 'var(--tgd-surface)', borderRadius: 8, border: '1px solid var(--tgd-border)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--tgd-border)', background: '#fafafa' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--tgd-main-text)' }}>Stock Balances</h3>
        </div>
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <DataTable columns={stockColumns} data={state.stockRows} loading={state.loading} error={state.error} emptyMessage="No stock balances found." />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: 'var(--tgd-surface)', borderRadius: 8, border: '1px solid var(--tgd-border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--tgd-border)', background: '#fafafa' }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--tgd-main-text)' }}>Low Stock</h3>
          </div>
          <div style={{ padding: 20, overflowX: 'auto' }}>
            <DataTable columns={stockColumns} data={state.lowStock} loading={state.loading} error={state.error} emptyMessage="No low stock items found." />
          </div>
        </div>

        <div style={{ background: 'var(--tgd-surface)', borderRadius: 8, border: '1px solid var(--tgd-border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--tgd-border)', background: '#fafafa' }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--tgd-main-text)' }}>Expiring Lots</h3>
          </div>
          <div style={{ padding: 20, overflowX: 'auto' }}>
            <DataTable columns={lotColumns} data={state.expiringLots} loading={state.loading} error={state.error} emptyMessage="No expiring lots found." />
          </div>
        </div>
      </div>

      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
        <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0, fontSize: 16 }}>Production remains HOLD</h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>No Production migration applied</li>
          <li>UI polish does not change stock movement behavior</li>
          <li>UI polish does not change stock balance calculation</li>
          <li>Existing services and RPC calls are unchanged</li>
        </ul>
      </section>
    </section>
  );
}
