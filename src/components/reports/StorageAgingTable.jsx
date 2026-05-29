import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'customer_id', header: 'Customer', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'product_id', header: 'Product', render: (row) => row.product_name ?? row.product_id ?? '-' },
  { key: 'lot_id', header: 'Lot', render: (row) => row.lot_no ?? row.lot_id ?? '-' },
  { key: 'pallet_id', header: 'Pallet', render: (row) => row.pallet_no ?? row.pallet_id ?? '-' },
  { key: 'warehouse_id', header: 'Warehouse', render: (row) => row.warehouse_name ?? row.warehouse_id ?? '-' },
  { key: 'room_zone', header: 'Room / Zone', render: (row) => row.room_code ?? row.zone_code ?? '-' },
  { key: 'location_id', header: 'Location', render: (row) => row.location_code ?? row.location_id ?? '-' },
  { key: 'condition_status', header: 'Condition', render: (row) => row.condition_status ?? '-' },
  { key: 'qty_on_hand', header: 'Stock Qty' },
  { key: 'uom', header: 'UOM' },
  { key: 'storage_start_date', header: 'Storage Start / Received', render: (row) => row.storage_start_date ?? row.received_date ?? '-' },
  { key: 'aging_days', header: 'Aging Days' },
  { key: 'aging_bucket', header: 'Aging Bucket' },
  { key: 'expiry_date', header: 'Expiry Date', render: (row) => row.expiry_date ?? row.exp_date ?? '-' },
  { key: 'expiry_status', header: 'Expiry Status' },
  { key: 'chargeable_days', header: 'Chargeable Days' },
  { key: 'billing_note', header: 'Billing Note', render: () => 'Storage duration review only' },
];

export function StorageAgingTable({ data, loading, error, emptyMessage = 'No storage aging rows found.' }) {
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
