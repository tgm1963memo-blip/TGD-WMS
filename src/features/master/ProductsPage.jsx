import { useEffect, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { UatOnly } from '../../components/common/UatOnly.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getProducts } from '../../services/masterDataService.js';

const columns = [
  { key: 'product_code', header: 'Code' },
  { key: 'product_name', header: 'Name' },
  { key: 'base_uom', header: 'Base UOM' },
  { key: 'temperature_type', header: 'Temperature' },
  { key: 'is_active', header: 'Status', render: (row) => <StatusBadge value={row.is_active} /> },
];

export function ProductsPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getProducts().then(({ data, error }) => {
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
      <PageHeader title="Products" description="Read-only product master list." />
      <UatOnly><p className="sprint-status">Sprint status: placeholder only</p></UatOnly>
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No products found." />
    </section>
  );
}
