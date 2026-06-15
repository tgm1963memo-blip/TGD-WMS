import { useEffect, useState } from 'react';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getWithdrawalAllocations } from '../../../services/withdrawalAllocationService.js';

const columns = [
  { key: 'allocation_no', header: 'Allocation No', render: (row) => documentLink(`/operations/allocations/${row.id}`, row.allocation_no) },
  { key: 'withdrawal_request_id', header: 'Withdrawal Request' },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'allocation_method', header: 'Method' },
  { key: 'created_at', header: 'Created At' },
];

export function AllocationListPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getWithdrawalAllocations().then(({ data, error }) => {
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
      <PageHeader title="Allocations" description="Withdrawal allocation list." />
      <DocumentToolbar title="Allocation Documents" createHref="/operations/allocations/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No allocations found." />
    </section>
  );
}
