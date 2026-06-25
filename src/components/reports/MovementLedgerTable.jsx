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
    header: 'วันที่',
    render: (row) => (
      <span className="table-meta-text">
        {formatDocumentDate(row.movement_date ?? row.created_at, { dateOnly: false })}
      </span>
    ),
  },
  {
    key: 'movement_type',
    header: 'ประเภท',
    render: (row) => <StatusBadge value={row.movement_type} />,
  },
  {
    key: 'product_id',
    header: 'สินค้า',
    render: (row) => {
      const code = row.product_code ?? row.customer_product_code ?? '';
      const name = row.product_name ?? row.source_document_no ?? row.product_id ?? '';
      const display = code ? `${code} - ${name}` : name;
      return (
        <span className="compact-cell-text" title={display}>
          {formatCompactText(display, 64)}
        </span>
      );
    },
    title: (row) => {
      const code = row.product_code ?? row.customer_product_code ?? '';
      const name = row.product_name ?? row.product_id ?? '';
      return code ? `${code} - ${name}` : name;
    },
  },
  {
    key: 'customer_id',
    header: 'ลูกค้า',
    render: (row) => <span className="compact-cell-text">{formatCompactText(row.customer_name ?? row.customer_id, 48)}</span>,
    title: (row) => row.customer_name ?? row.customer_id,
  },
  {
    key: 'qty',
    header: 'จำนวน',
    render: (row) => {
      const qty = Number(row.qty ?? 0);
      return <span className="compact-cell-qty">{qty > 0 ? `+${qty}` : qty}</span>;
    },
  },
  {
    key: 'reference_no',
    header: 'อ้างอิง',
    render: (row) => (
      <span className="compact-cell-text">
        {formatCompactText(row.source_document_no ?? row.reference_no ?? row.reference_id, 24)}
      </span>
    ),
    title: (row) => row.source_document_no ?? row.reference_no ?? row.reference_id,
  },
];

function renderMovementDetail(row) {
  return (
    <>
      <DetailField label="วันที่เคลื่อนไหว" value={formatDocumentDate(row.movement_date ?? row.created_at)} />
      <DetailField label="ประเภท" value={row.movement_type} />
      <DetailField label="สินค้า" value={row.product_name ?? row.product_id} />
      <DetailField label="ลูกค้า" value={row.customer_name ?? row.customer_id} />
      <DetailField label="ล็อต" value={row.lot_id} />
      <DetailField label="ตำแหน่งต้นทาง" value={row.from_location_id} />
      <DetailField label="ตำแหน่งปลายทาง" value={row.to_location_id} />
      <DetailField label="จำนวน" value={row.qty} />
      <DetailField label="หน่วย" value={row.uom} />
      <DetailField label="ประเภทอ้างอิง" value={row.reference_type} />
      <DetailField label="เลขที่อ้างอิง" value={row.reference_no} />
      <DetailField label="เอกสารอ้างอิง" value={row.reference_id} />
      <DetailField label="วันที่สร้าง" value={formatDocumentDate(row.created_at)} />
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
      emptyMessage="ไม่พบข้อมูลรายการเคลื่อนไหว"
      tableTestId="movement-ledger-table"
    />
  );
}
