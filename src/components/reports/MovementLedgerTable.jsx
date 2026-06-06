import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'created_at', header: 'Movement Date', render: (row) => <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>{row.created_at}</span> },
  { key: 'movement_type', header: 'Movement Type', render: (row) => (
      <span style={{ padding: '4px 8px', borderRadius: 4, background: 'var(--tgd-main-bg)', color: 'var(--tgd-info)', fontWeight: 600, fontSize: 12, border: '1px solid var(--tgd-border)' }}>
        {row.movement_type}
      </span>
  )},
  { key: 'product_id', header: 'Product', render: (row) => <span style={{ fontWeight: 600, color: 'var(--tgd-main-text)' }}>{row.product_id}</span> },
  { key: 'customer_id', header: 'Customer' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'from_location_id', header: 'Source Location', render: (row) => <span style={{ color: 'var(--tgd-warning)', fontWeight: 500 }}>{row.from_location_id || '-'}</span> },
  { key: 'to_location_id', header: 'Target Location', render: (row) => <span style={{ color: 'var(--tgd-success)', fontWeight: 500 }}>{row.to_location_id || '-'}</span> },
  { key: 'qty', header: 'Qty', render: (row) => <span style={{ fontWeight: 700, fontSize: 14 }}>{row.qty > 0 ? `+${row.qty}` : row.qty}</span> },
  { key: 'uom', header: 'UOM', render: (row) => <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>{row.uom}</span> },
  { key: 'reference_type', header: 'Ref Type' },
  { key: 'reference_id', header: 'Document No', render: (row) => <span style={{ fontWeight: 600, color: 'var(--tgd-primary-gold)', cursor: 'pointer' }}>{row.reference_id}</span> },
];

export function MovementLedgerTable({ data = [], loading = false, error = null }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No movement ledger rows found."
    />
  );
}
