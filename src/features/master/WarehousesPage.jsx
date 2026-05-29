import { useEffect, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getWarehouses } from '../../services/masterDataService.js';

const columns = [
  { key: 'warehouse_code', header: 'Code' },
  { key: 'warehouse_name', header: 'Name' },
  { key: 'warehouse_type', header: 'Type' },
  { key: 'is_active', header: 'Status', render: (row) => <StatusBadge value={row.is_active} /> },
];

export function WarehousesPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getWarehouses().then(({ data, error }) => {
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
      <PageHeader title="Warehouses" description="Read-only warehouse master list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No warehouses found." />
    </section>
  );
}
