import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'customer_id', header: 'Customer', render: (row) => row.customer_id ?? '-' },
  { key: 'warehouse_id', header: 'Warehouse', render: (row) => row.warehouse_id ?? row.from_warehouse_id ?? row.to_warehouse_id ?? '-' },
  { key: 'charge_type', header: 'Charge Type', render: (row) => row.charge_type ?? row.movement_subtype ?? 'OTHER' },
  { key: 'qty', header: 'Qty / Weight', render: (row) => row.qty ?? row.charge_qty ?? 0 },
  { key: 'preview_amount', header: 'Preview Amount', render: (row) => row.preview_amount ?? row.operation_charge_preview ?? 0 },
  { key: 'reference_type', header: 'Reference Type', render: (row) => row.reference_type ?? '-' },
  { key: 'reference_no', header: 'Reference No', render: (row) => row.reference_no ?? '-' },
  { key: 'created_at', header: 'Created At', render: (row) => row.created_at ?? '-' },
];

export function OperationChargePreviewTable({ data, loading, error }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No operation charge preview rows found."
    />
  );
}
