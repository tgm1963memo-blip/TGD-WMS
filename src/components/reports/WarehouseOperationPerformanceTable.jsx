import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'operation_date', header: 'Operation Date', render: (row) => row.operation_date ?? '-' },
  { key: 'operation_type', header: 'Operation Type' },
  { key: 'document_no', header: 'Document No', render: (row) => row.document_no ?? '-' },
  { key: 'customer_id', header: 'Customer', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'warehouse_id', header: 'Warehouse', render: (row) => row.warehouse_name ?? row.warehouse_id ?? '-' },
  { key: 'status', header: 'Status', render: (row) => row.status ?? '-' },
  { key: 'qty', header: 'Qty / Weight', render: (row) => row.qty ?? row.weight ?? '-' },
  { key: 'charge_type', header: 'Charge Type', render: (row) => row.charge_type ?? '-' },
  { key: 'reference', header: 'Reference', render: (row) => row.reference ?? '-' },
  { key: 'created_at', header: 'Created At', render: (row) => row.created_at ?? '-' },
  { key: 'created_by', header: 'Created By', render: (row) => row.created_by ?? '-' },
  { key: 'billing_relevance_note', header: 'Billing Relevance Note', render: (row) => row.billing_relevance_note ?? 'Workload review only' },
];

export function WarehouseOperationPerformanceTable({ data, loading, error }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No warehouse operation performance rows found."
    />
  );
}
