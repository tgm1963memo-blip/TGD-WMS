import { useEffect, useState } from 'react';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getAdjustmentDocuments } from '../../../services/adjustmentService.js';

const columns = [
  { key: 'adjustment_no', header: 'Adjustment No', render: (row) => documentLink(`/operations/adjustment/${row.id}`, row.adjustment_no) },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'adjustment_type', header: 'Type' },
  { key: 'created_at', header: 'Created At' },
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
      <div className="dashboard-header-actions operations-page-actions">
        <span className="production-hold-badge">Production HOLD</span>
      </div>

      <div className="operations-filter-card">
        <DocumentFilterBar onChange={() => {}} />
      </div>

      <div className="operations-table-card">
        <div className="operations-table-card-header">
          <h3 className="operations-table-card-title">Adjustment Documents</h3>
          <DocumentToolbar title="" createHref="/operations/adjustment/new" onRefresh={() => window.location.reload()} />
        </div>
        <div className="operations-table-card-body">
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
