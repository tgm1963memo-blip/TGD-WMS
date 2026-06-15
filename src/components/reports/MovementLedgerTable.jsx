import { StatusBadge } from '../ui/StatusBadge.jsx';
import { CompactExpandableTable } from '../ui/CompactExpandableTable.jsx';
import { formatCompactText, formatDetailValue, formatDocumentDate } from '../../utils/documentDisplayUtils.js';

function DetailField({ label, value }) {
  return (
    <div className="compact-detail-field">
      <span className="compact-detail-label">{label}</span>
      <span className="compact-detail-value">{formatDetailValue(value)}</span>
    </div>
  );
}

const summaryColumns = [
  {
    key: 'created_at',
    header: 'Date',
    render: (row) => (
      <span className="table-meta-text">
        {formatDocumentDate(row.movement_date ?? row.created_at, { dateOnly: false })}
      </span>
    ),
  },
  {
    key: 'movement_type',
    header: 'Type',
    render: (row) => <StatusBadge value={row.movement_type} />,
  },
  {
    key: 'product_id',
    header: 'Product',
    render: (row) => (
      <span className="compact-cell-text">
        {formatCompactText(row.source_document_no ?? row.product_id, 20)}
      </span>
    ),
    title: (row) => row.product_id,
  },
  {
    key: 'customer_id',
    header: 'Customer',
    render: (row) => <span className="compact-cell-text">{formatCompactText(row.customer_id, 16)}</span>,
    title: (row) => row.customer_id,
  },
  {
    key: 'qty',
    header: 'Qty',
    render: (row) => {
      const qty = Number(row.qty ?? 0);
      return <span className="compact-cell-qty">{qty > 0 ? `+${qty}` : qty}</span>;
    },
  },
  {
    key: 'reference_no',
    header: 'Ref',
    render: (row) => (
      <span className="compact-cell-text">
        {formatCompactText(row.reference_no ?? row.reference_id, 16)}
      </span>
    ),
    title: (row) => row.reference_no ?? row.reference_id,
  },
];

function renderMovementDetail(row) {
  return (
    <>
      <DetailField label="Movement Date" value={formatDocumentDate(row.movement_date ?? row.created_at)} />
      <DetailField label="Movement Type" value={row.movement_type} />
      <DetailField label="Product ID" value={row.product_id} />
      <DetailField label="Customer ID" value={row.customer_id} />
      <DetailField label="Lot ID" value={row.lot_id} />
      <DetailField label="Source Location" value={row.from_location_id} />
      <DetailField label="Target Location" value={row.to_location_id} />
      <DetailField label="Qty" value={row.qty} />
      <DetailField label="UOM" value={row.uom} />
      <DetailField label="Reference Type" value={row.reference_type} />
      <DetailField label="Reference No" value={row.reference_no} />
      <DetailField label="Document ID" value={row.reference_id} />
      <DetailField label="Created At" value={formatDocumentDate(row.created_at)} />
    </>
  );
}

export function MovementLedgerTable({ data = [], loading = false, error = null }) {
  return (
    <CompactExpandableTable
      rows={data}
      rowKey={(row) => row.id ?? `${row.movement_type}-${row.created_at}-${row.reference_id}`}
      summaryColumns={summaryColumns}
      renderDetail={renderMovementDetail}
      loading={loading}
      error={error}
      emptyMessage="No movement ledger rows found."
      tableTestId="movement-ledger-table"
    />
  );
}
