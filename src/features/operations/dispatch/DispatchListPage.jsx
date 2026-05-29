import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getDispatchDocuments } from '../../../services/dispatchService.js';

const columns = [
  { key: 'dispatch_no', header: 'Dispatch No', render: (row) => <Link to={`/operations/dispatch/${row.id}`}>{row.dispatch_no}</Link> },
  { key: 'withdrawal_request_id', header: 'Withdrawal Request' },
  { key: 'picking_document_id', header: 'Picking Document' },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'dispatch_type', header: 'Type' },
  { key: 'dispatch_date', header: 'Dispatch Date' },
  { key: 'created_at', header: 'Created At' },
];

export function DispatchListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getDispatchDocuments().then(({ data, error }) => {
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
      <PageHeader title="Dispatch" description="Dispatch document list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DocumentToolbar title="Dispatch Documents" createHref="/operations/dispatch/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No dispatch documents found." />
    </section>
  );
}
