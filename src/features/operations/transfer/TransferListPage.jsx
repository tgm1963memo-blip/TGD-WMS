import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getTransferDocuments } from '../../../services/transferService.js';

const columns = [
  { key: 'transfer_no', header: 'Transfer No', render: (row) => <Link to={`/operations/transfer/${row.id}`}>{row.transfer_no}</Link> },
  { key: 'from_warehouse_id', header: 'From Warehouse' },
  { key: 'to_warehouse_id', header: 'To Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'transfer_type', header: 'Type' },
  { key: 'created_at', header: 'Created At' },
];

export function TransferListPage() {
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
    <section className="page-shell">
      <PageHeader title="Transfer" description="Internal transfer document list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DocumentToolbar title="Transfer Documents" createHref="/operations/transfer/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No transfer documents found." />
    </section>
  );
}
