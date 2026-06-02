import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getReceivingDocuments } from '../../../services/receivingService.js';

const columns = [
  {
    key: 'receiving_no',
    header: 'Receiving No',
    render: (row) => <Link to={`/operations/receiving/${row.id}`}>{row.receiving_no}</Link>,
  },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'receiving_type', header: 'Type' },
  { key: 'expected_receive_date', header: 'Date' },
  { key: 'created_at', header: 'Created At' },
];

export function ReceivingListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getReceivingDocuments().then(({ data, error }) => {
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
      <PageHeader title="Receiving" description="Inbound receiving document list." />
      <p className="sprint-status">Sprint status: controlled draft only</p>
      <section
        className="warning-panel"
        role="status"
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          color: '#92400e',
          marginBottom: 16,
          padding: 14,
        }}
      >
        Receiving creation is controlled draft mode only. Confirm/Post remains locked.
      </section>
      <DocumentToolbar
        title="Receiving Documents"
        createHref="/operations/receiving/create"
        createLabel="Create Receiving Draft"
        onRefresh={() => window.location.reload()}
      />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        error={state.error}
        emptyMessage="No receiving documents found."
      />
    </section>
  );
}
