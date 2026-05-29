import React from 'react';
import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'bplus_customer_code', header: 'Bplus Customer Code', render: (row) => row.bplus_customer_code ?? '-' },
  { key: 'bplus_customer_name', header: 'Bplus Customer Name', render: (row) => row.bplus_customer_name ?? '-' },
  { key: 'bplus_billing_period', header: 'Bplus Billing Period', render: (row) => row.bplus_billing_period ?? '-' },
  { key: 'bplus_service_code', header: 'Bplus Service Code', render: (row) => row.bplus_service_code ?? '-' },
  { key: 'bplus_service_description', header: 'Bplus Service Description', render: (row) => row.bplus_service_description ?? '-' },
  { key: 'bplus_quantity', header: 'Bplus Quantity', render: (row) => row.bplus_quantity ?? 0 },
  { key: 'bplus_weight', header: 'Bplus Weight', render: (row) => row.bplus_weight ?? 0 },
  { key: 'bplus_unit', header: 'Bplus Unit', render: (row) => row.bplus_unit ?? '-' },
  { key: 'bplus_accounting_note', header: 'Bplus Accounting Note', render: (row) => row.bplus_accounting_note ?? '-' },
  { key: 'bplus_validation_status', header: 'Bplus Validation Status', render: (row) => row.bplus_validation_status ?? '-' },
];

export function BplusDraftPayloadTable({ data, loading, error }) {
  return (
    <div style={{ position: 'relative' }}>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        emptyMessage="No Bplus mapped draft rows found."
      />
      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
        * Note: These rows represent an in-memory preview of the mapped Bplus draft schema structure. There are no functions, buttons, or controls to export this data or execute an external handoff.
      </div>
    </div>
  );
}
