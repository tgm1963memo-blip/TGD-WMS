import { DataTable } from '../ui/DataTable.jsx';
import { formatFixed2 } from '../../utils/numberFormat.js';

const columns = [
  { key: 'customer_name', header: 'Customer', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'product_code', header: 'Product', render: (row) => `${row.product_code ?? '-'}${row.product_name ? ` — ${row.product_name}` : ''}` },
  { key: 'lot_no', header: 'Lot', render: (row) => row.lot_no ?? '-' },
  { key: 'temperature_type', header: 'Temp', render: (row) => row.temperature_type ?? '-' },
  { key: 'qty_boxes', header: 'Stock Qty (Boxes)', render: (row) => row.qty_boxes.toLocaleString() },
  { key: 'qty_weight', header: 'Stock Weight (kg)', render: (row) => formatFixed2(row.qty_weight) },
  { key: 'uom', header: 'UOM' },
  { key: 'received_at', header: 'Received', render: (row) => (row.received_at ?? '-').slice(0, 10) || '-' },
  { key: 'request_no', header: 'Deposit Doc No.', render: (row) => row.request_no ?? '-' },
];

export function CustomerStorageBalanceTable({ data, loading, error }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No customer-owned inventory balance rows found."
    />
  );
}
