import { useEffect, useState } from 'react';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge, renderTableMeta } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPageShellClassName, isProductionPresentationActive } from '../../../config/pageShellPresentation.js';
import { getTransferDocuments } from '../../../services/transferService.js';

const columns = [
  { key: 'transfer_no', header: 'Transfer No', render: (row) => documentLink(`/operations/transfer/${row.id}`, row.transfer_no) },
  { key: 'from_warehouse_id', header: 'From Warehouse' },
  { key: 'to_warehouse_id', header: 'To Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'transfer_type', header: 'Type', render: (row) => <span className="table-meta-text">{row.transfer_type}</span> },
  { key: 'created_at', header: 'Created At', render: (row) => renderTableMeta(row.created_at) },
];

export function TransferListPage() {
  const goLive = isProductionPresentationActive();
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getTransferDocuments().then(({ data, error }) => {
      if (isMounted) {
        setState({ data: data ?? [], loading: false, error });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="Internal Transfer"
        description="Warehouse transfer and movement control."
      />
      {!goLive ? (
        <div className="dashboard-header-actions operations-page-actions">
          <span className="production-hold-badge">Production HOLD</span>
        </div>
      ) : null}

      <div className="operations-filter-card">
        <DocumentFilterBar onChange={() => {}} />
      </div>

      <div className="operations-table-card">
        <div className="operations-table-card-header">
          <h3 className="operations-table-card-title">Transfer Documents</h3>
          <DocumentToolbar title="" createHref="/operations/transfer/new" onRefresh={() => window.location.reload()} />
        </div>
        <div className="operations-table-card-body">
          <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No transfer documents found." />
        </div>
      </div>

      {!goLive ? (
      <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginTop: 24 }}>
        <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0, fontSize: 16 }}>Production remains HOLD</h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>No Production migration applied</li>
          <li>UI polish does not change stock movement behavior</li>
          <li>UI polish does not change stock balance calculation</li>
          <li>Existing services and RPC calls are unchanged</li>
        </ul>
      </section>
      ) : null}
    </section>
  );
}
