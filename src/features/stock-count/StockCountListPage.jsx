import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getStockCountDocuments } from '../../services/stockCountService.js';

const columns = [
  { key: 'stock_count_no', header: 'Stock Count No', render: (row) => <Link to={`/stock-count/${row.id}`}>{row.stock_count_no}</Link> },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'count_type', header: 'Count Type' },
  { key: 'count_date', header: 'Count Date' },
  { key: 'created_at', header: 'Created At' },
];

export function StockCountListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getStockCountDocuments().then(({ data, error }) => {
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
      <PageHeader title="Stock Count" description="Stock count document list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DocumentToolbar title="Stock Count Documents" createHref="/stock-count/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No stock count documents found." />
    </section>
  );
}
