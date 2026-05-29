import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'billing_period', header: 'Billing Period', render: (row) => row.billing_period ?? '-' },
  { key: 'customer_id', header: 'Customer', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'warehouse_id', header: 'Warehouse', render: (row) => row.warehouse_name ?? row.warehouse_id ?? '-' },
  { key: 'deposit_qty', header: 'Deposit / Inbound Qty', render: (row) => row.deposit_qty ?? row.inbound_qty ?? 0 },
  { key: 'withdrawal_qty', header: 'Withdrawal / Outbound Qty', render: (row) => row.withdrawal_qty ?? row.outbound_qty ?? 0 },
  { key: 'remaining_qty', header: 'Remaining Qty', render: (row) => row.remaining_qty ?? row.qty_on_hand ?? row.qty_available ?? 0 },
  { key: 'average_storage_qty', header: 'Average Storage Qty', render: (row) => row.average_storage_qty ?? 'Preview pending' },
  { key: 'chargeable_weight_or_qty', header: 'Chargeable Weight / Qty', render: (row) => row.chargeable_weight ?? row.chargeable_qty ?? 0 },
  { key: 'storage_rate', header: 'Storage Rate', render: (row) => row.storage_rate ?? row.rate ?? 'Rate review needed' },
  { key: 'operation_charge_preview', header: 'Operation Charge Preview', render: (row) => row.operation_charge_preview ?? row.preview_amount ?? 0 },
  { key: 'estimated_amount', header: 'Estimated Amount', render: (row) => row.total_preview_amount ?? row.storage_charge_preview ?? row.operation_charge_preview ?? 0 },
  { key: 'validation_status', header: 'Validation Status', render: (row) => row.validation_status ?? 'READY_FOR_REVIEW' },
  { key: 'accounting_note', header: 'Accounting Note', render: (row) => row.accounting_note ?? 'Preview row for accounting review' },
];

export function MonthlyBillingSummaryTable({ data, loading, error }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No monthly storage billing summary preview rows found."
    />
  );
}
