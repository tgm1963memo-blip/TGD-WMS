import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getAdjustmentDocuments } from '../../../services/adjustmentService.js';

const columns = [
  { key: 'adjustment_no', header: 'Adjustment No', render: (row) => <Link to={`/operations/adjustment/${row.id}`}>{row.adjustment_no}</Link> },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
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
      <PageHeader title="Adjustment" description="Inventory adjustment document list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DocumentToolbar title="Adjustment Documents" createHref="/operations/adjustment/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No adjustment documents found." />
    </section>
  );
}
