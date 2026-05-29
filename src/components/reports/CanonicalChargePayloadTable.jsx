import React from 'react';
import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'billing_period', header: 'Billing Period', render: (row) => row.billing_period ?? '-' },
  { key: 'customer_code', header: 'Customer Code', render: (row) => row.customer_code ?? '-' },
  { key: 'customer_name', header: 'Customer Name', render: (row) => row.customer_name ?? '-' },
  { key: 'warehouse_code', header: 'Warehouse Code', render: (row) => row.warehouse_code ?? '-' },
  { key: 'deposit_qty', header: 'Deposit Qty', render: (row) => row.deposit_qty ?? 0 },
  { key: 'withdrawal_qty', header: 'Withdrawal Qty', render: (row) => row.withdrawal_qty ?? 0 },
  { key: 'remaining_qty', header: 'Remaining Qty', render: (row) => row.remaining_qty ?? 0 },
  { key: 'chargeable_qty', header: 'Chargeable Qty', render: (row) => row.chargeable_qty ?? 0 },
  { key: 'chargeable_weight', header: 'Chargeable Weight', render: (row) => row.chargeable_weight ?? 0 },
  { key: 'validation_status', header: 'Validation Status', render: (row) => row.validation_status ?? 'DRAFT' },
  { key: 'accounting_note', header: 'Accounting Note', render: (row) => row.accounting_note ?? '-' },
];

export function CanonicalChargePayloadTable({ data, loading, error }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No canonical accounting charge rows found."
    />
  );
}
