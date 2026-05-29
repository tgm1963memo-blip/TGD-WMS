import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'group_id', header: 'Group' },
  { key: 'qty_on_hand', header: 'On Hand' },
  { key: 'qty_allocated', header: 'Allocated' },
  { key: 'qty_available', header: 'Available' },
  { key: 'sku_count', header: 'SKUs' },
];

export function InventorySummaryTable({ data = [], loading = false, error = null, emptyMessage = 'No inventory summary found.' }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage={emptyMessage}
    />
  );
}
