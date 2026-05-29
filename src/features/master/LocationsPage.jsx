import { useEffect, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getLocations } from '../../services/masterDataService.js';

const columns = [
  { key: 'location_code', header: 'Code' },
  { key: 'location_name', header: 'Name' },
  { key: 'location_type', header: 'Type' },
  { key: 'barcode', header: 'Barcode' },
  { key: 'is_active', header: 'Status', render: (row) => <StatusBadge value={row.is_active} /> },
];

export function LocationsPage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getLocations().then(({ data, error }) => {
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
      <PageHeader title="Locations" description="Read-only location master list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No locations found." />
    </section>
  );
}
