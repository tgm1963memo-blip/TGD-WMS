import { useEffect, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { UatOnly } from '../../components/common/UatOnly.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getCustomers } from '../../services/masterDataService.js';

const columns = [
  { key: 'customer_code', header: 'Code' },
  { key: 'customer_name', header: 'Name' },
  { key: 'customer_type', header: 'Type' },
  { key: 'phone', header: 'Phone' },
  { key: 'is_active', header: 'Status', render: (row) => <StatusBadge value={row.is_active} /> },
];

export function CustomersPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getCustomers().then(({ data, error }) => {
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
      <PageHeader title="Customers" description="Read-only customer master list." />
      <UatOnly><p className="sprint-status">Sprint status: placeholder only</p></UatOnly>
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No customers found." />
    </section>
  );
}
