import { useEffect, useState } from 'react';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPickingDocuments } from '../../../services/pickingService.js';

const columns = [
  { key: 'picking_no', header: 'Picking No', render: (row) => documentLink(`/operations/picking/${row.id}`, row.picking_no) },
  { key: 'withdrawal_request_id', header: 'Withdrawal Request' },
  { key: 'allocation_id', header: 'Allocation' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'picking_method', header: 'Method' },
  { key: 'created_at', header: 'Created At' },
];

export function PickingListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getPickingDocuments().then(({ data, error }) => {
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
      <PageHeader title="Picking" description="Picking document list." />
      <DocumentToolbar title="Picking Documents" createHref="/operations/picking/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No picking documents found." />
    </section>
  );
}
