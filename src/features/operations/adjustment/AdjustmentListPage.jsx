import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getAdjustmentDocuments } from '../../../services/adjustmentService.js';

const columns = [
  { key: 'adjustment_no', header: 'Adjustment No', render: (row) => <Link to={`/operations/adjustment/${row.id}`} style={{ fontWeight: 600, color: 'var(--tgd-primary-gold)', textDecoration: 'none' }}>{row.adjustment_no}</Link> },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'adjustment_type', header: 'Type', render: (row) => <span style={{ color: 'var(--tgd-muted-text)', fontSize: 13 }}>{row.adjustment_type}</span> },
  { key: 'created_at', header: 'Created At', render: (row) => <span style={{ color: 'var(--tgd-muted-text)', fontSize: 13 }}>{row.created_at}</span> },
];

export function AdjustmentListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getAdjustmentDocuments().then(({ data, error }) => {
      if (isMounted) {
        setState({ data: data ?? [], loading: false, error });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="page-shell">
      <PageHeader 
        title="Inventory Adjustment" 
        description="Warehouse stock adjustment and manual override control." 
      />
      <div className="dashboard-header-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
         <span className="production-hold-badge" style={{ padding: '8px 12px', background: 'var(--tgd-danger)', color: '#fff', borderRadius: 8, fontWeight: 600 }}>Production HOLD</span>
      </div>

      <div style={{ background: 'var(--tgd-surface)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid var(--tgd-border)' }}>
        <DocumentFilterBar onChange={() => {}} />
      </div>

      <div style={{ background: 'var(--tgd-surface)', borderRadius: 8, border: '1px solid var(--tgd-border)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--tgd-border)', background: '#fafafa' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--tgd-main-text)' }}>Adjustment Documents</h3>
          <DocumentToolbar title="" createHref="/operations/adjustment/new" onRefresh={() => window.location.reload()} />
        </div>
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No adjustment documents found." />
        </div>
      </div>

      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginTop: 24 }}>
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
