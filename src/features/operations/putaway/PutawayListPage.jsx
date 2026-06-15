import { useEffect, useState } from 'react';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPutawayDocuments } from '../../../services/putawayService.js';

const columns = [
  { key: 'putaway_no', header: 'Putaway No', render: (row) => documentLink(`/operations/putaway/${row.id}`, row.putaway_no) },
  { key: 'source_id', header: 'Receiving Ref' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'source_type', header: 'Type' },
  { key: 'created_at', header: 'Created At' },
];

export function PutawayListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getPutawayDocuments().then(({ data, error }) => {
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
      <PageHeader title="Putaway" description="Inbound putaway document list." />
      <DocumentToolbar title="Putaway Documents" createHref="/operations/putaway/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No putaway documents found." />
    </section>
  );
}
