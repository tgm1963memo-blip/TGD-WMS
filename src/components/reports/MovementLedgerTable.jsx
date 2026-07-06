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

export function fmtWt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0
    ? n.toLocaleString('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '-';
}

const INBOUND_TYPES = new Set([
  'RECEIVE_CONFIRM', 'RECEIVE', 'INBOUND', 'ADJUSTMENT_IN', 'RETURN',
  'RECEIVE_PENDING', 'CUSTOMER_NOTIFIED',
]);

export function isInbound(row) {
  const raw = String(row.movement_type_raw || row.movement_type || '').toUpperCase();
  return INBOUND_TYPES.has(raw) || raw.includes('RECEIVE') || raw.includes('INBOUND');
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
    key: 'lot_no',
    header: 'ล็อต',
    render: (row) => <span className="table-meta-text">{row.lot_no || '-'}</span>,
  },
  {
    key: 'temperature_type',
    header: 'อุณหภูมิ',
    render: (row) => <span className="table-meta-text">{row.temperature_type || '-'}</span>,
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
    key: 'inbound_qty',
    header: 'รับเข้า (กล่อง)',
    render: (row) => {
      if (!isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      const qty = Number(row.qty ?? row.quantity ?? 0);
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-success, #16a34a)' }}>+{qty}</span>;
    },
  },
  {
    key: 'inbound_weight',
    header: 'รับเข้า (KG)',
    render: (row) => {
      if (!isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-success, #16a34a)' }}>{fmtWt(row.weight)}</span>;
    },
  },
  {
    key: 'outbound_qty',
    header: 'จ่ายออก (กล่อง)',
    render: (row) => {
      if (isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      const qty = Number(row.qty ?? row.quantity ?? 0);
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-danger, #dc2626)' }}>-{qty}</span>;
    },
  },
  {
    key: 'outbound_weight',
    header: 'จ่ายออก (KG)',
    render: (row) => {
      if (isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-danger, #dc2626)' }}>{fmtWt(row.weight)}</span>;
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
  const inbound = isInbound(row);
  return (
    <>
      <DetailField label="วันที่เคลื่อนไหว" value={formatDocumentDate(row.movement_date ?? row.created_at)} />
      <DetailField label="ประเภท" value={row.movement_type} />
      <DetailField label="สินค้า" value={row.product_name ?? row.product_id} />
      <DetailField label="ลูกค้า" value={row.customer_name ?? row.customer_id} />
      <DetailField label="ล็อต" value={row.lot_no} />
      <DetailField label="อุณหภูมิ" value={row.temperature_type} />
      <DetailField label="ตำแหน่งต้นทาง" value={row.from_location_id} />
      <DetailField label="ตำแหน่งปลายทาง" value={row.to_location_id} />
      {inbound ? (
        <>
          <DetailField label="รับเข้า (กล่อง)" value={row.qty ?? row.quantity} />
          <DetailField label="รับเข้า (KG)" value={fmtWt(row.weight)} />
        </>
      ) : (
        <>
          <DetailField label="จ่ายออก (กล่อง)" value={row.qty ?? row.quantity} />
          <DetailField label="จ่ายออก (KG)" value={fmtWt(row.weight)} />
        </>
      )}
      <DetailField label="หน่วย" value={row.uom} />
      <DetailField label="ประเภทอ้างอิง" value={row.reference_type} />
      <DetailField label="เลขที่อ้างอิง" value={row.reference_no} />
      <DetailField label="เอกสารอ้างอิง" value={row.source_document_no ?? row.reference_id} />
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
