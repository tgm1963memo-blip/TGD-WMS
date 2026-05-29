import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'movement_type', header: 'Movement Type' },
  { key: 'movement_count', header: 'Rows' },
  { key: 'total_qty', header: 'Total Qty' },
];

export function MovementTypeBreakdown({ data = [], loading = false, error = null }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No movement type rows found."
    />
  );
}
