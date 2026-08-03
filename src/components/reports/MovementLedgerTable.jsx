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

// Product identity used to decide whether two adjacent rows belong to the
// same product block — mirrors movementBalanceKey's product half in
// movementLedgerExcelUtils.js (kept as a local, independent copy rather than
// an import: that util file already imports isInbound/fmtWt FROM this file,
// so importing back from it here would create a circular dependency).
export function productIdentityOf(row) {
  return `${row.product_code ?? row.customer_product_code ?? ''}|${row.product_name ?? row.product_id ?? ''}`;
}

// Annotates each row with whether to show the product cell (only on the
// first row of a run of adjacent same-product rows, so a product spanning
// several lots/tracking codes shows its name/code once) and whether it's
// the last row of its group (so a divider can mark where one lot's/tracking
// code's rows end and the next begins). Purely derived from row ADJACENCY,
// so it only visibly groups anything when rows arrive pre-sorted by
// product-then-lot or product-then-tracking-code upstream — in plain
// chronological order, adjacent rows essentially never share a group.
export function annotateGroupedRows(rows, groupBy = 'lot') {
  const field = groupBy === 'trackingCode' ? 'tracking_code' : 'lot_no';
  return rows.map((row, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    const sameProductAsPrev = prev && productIdentityOf(prev) === productIdentityOf(row);
    const sameGroupAsNext = next
      && productIdentityOf(next) === productIdentityOf(row)
      && (next[field] ?? '') === (row[field] ?? '');
    return { ...row, _showProductCell: !sameProductAsPrev, _isLastOfLotGroup: !sameGroupAsNext };
  });
}

const summaryColumns = [
  {
    key: 'created_at',
    header: 'วันที่',
    width: '7%',
    render: (row) => (
      <span className="table-meta-text">
        {formatDocumentDate(row.movement_date ?? row.created_at, { dateOnly: false })}
      </span>
    ),
  },
  {
    key: 'movement_type',
    header: 'ประเภท',
    width: '9%',
    render: (row) => <StatusBadge value={row.movement_type} />,
  },
  {
    key: 'tracking_code',
    header: 'รหัสติดตาม',
    width: '9%',
    render: (row) => <span className="table-meta-text">{row.tracking_code || '-'}</span>,
    title: (row) => row.tracking_code,
  },
  {
    key: 'product_id',
    header: 'สินค้า',
    width: '22%',
    cellClassName: 'compact-table-cell--wide',
    render: (row) => {
      if (row._showProductCell === false) return null;
      const code = row.product_code ?? row.customer_product_code ?? '';
      const name = row.product_name ?? row.source_document_no ?? row.product_id ?? '';
      const display = code ? `${code} - ${name}` : name;
      return (
        <span className="compact-cell-text compact-cell-text--wide" title={display}>
          {formatCompactText(display, 96)}
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
    key: 'lot_no',
    header: 'lot',
    width: '6%',
    render: (row) => <span className="table-meta-text">{row.lot_no || '-'}</span>,
  },
  {
    key: 'mfg_date',
    header: 'วันผลิต',
    width: '7%',
    render: (row) => (
      <span className="table-meta-text">
        {row.mfg_date ? formatDocumentDate(row.mfg_date, { dateOnly: true }) : '-'}
      </span>
    ),
  },
  {
    key: 'inbound_qty',
    header: 'รับเข้า(กล่อง)',
    width: '7%',
    render: (row) => {
      if (!isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      const qty = Number(row.qty ?? row.quantity ?? 0);
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-success, #16a34a)' }}>{qty}</span>;
    },
  },
  {
    key: 'inbound_weight',
    header: 'รับเข้า(น้ำหนัก)',
    width: '8%',
    render: (row) => {
      if (!isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-success, #16a34a)' }}>{fmtWt(row.weight)}</span>;
    },
  },
  {
    key: 'outbound_qty',
    header: 'จ่ายออก(กล่อง)',
    width: '7%',
    render: (row) => {
      if (isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      const qty = Number(row.qty ?? row.quantity ?? 0);
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-danger, #dc2626)' }}>{qty}</span>;
    },
  },
  {
    key: 'outbound_weight',
    header: 'จ่ายออก(น้ำหนัก)',
    width: '8%',
    render: (row) => {
      if (isInbound(row)) return <span style={{ color: '#ccc' }}>-</span>;
      return <span className="compact-cell-qty" style={{ color: 'var(--tgd-danger, #dc2626)' }}>{fmtWt(row.weight)}</span>;
    },
  },
  {
    key: 'balance_qty',
    header: 'คงเหลือ(กล่อง)',
    width: '6%',
    render: (row) => (
      <span className="compact-cell-qty" style={{ fontWeight: 600 }}>
        {row.balanceQty ?? '-'}
      </span>
    ),
  },
  {
    key: 'balance_weight',
    header: 'คงเหลือ(น้ำหนัก)',
    width: '8%',
    render: (row) => (
      <span className="compact-cell-qty" style={{ fontWeight: 600 }}>
        {row.balanceWeight !== undefined ? fmtWt(row.balanceWeight) : '-'}
      </span>
    ),
  },
];

function renderMovementDetail(row) {
  const inbound = isInbound(row);
  return (
    <>
      <DetailField label="วันที่เคลื่อนไหว" value={formatDocumentDate(row.movement_date ?? row.created_at)} />
      <DetailField label="ประเภท" value={row.movement_type} />
      <DetailField label="รหัสติดตาม" value={row.tracking_code} />
      <DetailField label="สินค้า" value={row.product_name ?? row.product_id} />
      <DetailField label="ลูกค้า" value={row.customer_name ?? row.customer_id} />
      <DetailField label="ล็อต" value={row.lot_no} />
      <DetailField label="วันผลิต" value={row.mfg_date ? formatDocumentDate(row.mfg_date, { dateOnly: true }) : null} />
      <DetailField label="อุณหภูมิ" value={row.temperature_type} />
      <DetailField label="ตำแหน่งต้นทาง" value={row.from_location_id} />
      <DetailField label="ตำแหน่งปลายทาง" value={row.to_location_id} />
      {inbound ? (
        <>
          <DetailField label="รับเข้า (กล่อง)" value={row.qty ?? row.quantity} />
          <DetailField label="รับเข้า (น้ำหนัก)" value={fmtWt(row.weight)} />
        </>
      ) : (
        <>
          <DetailField label="จ่ายออก (กล่อง)" value={row.qty ?? row.quantity} />
          <DetailField label="จ่ายออก (น้ำหนัก)" value={fmtWt(row.weight)} />
        </>
      )}
      <DetailField label="คงเหลือ (กล่อง)" value={row.balanceQty} />
      <DetailField label="คงเหลือ (น้ำหนัก)" value={row.balanceWeight !== undefined ? fmtWt(row.balanceWeight) : undefined} />
      <DetailField label="หน่วย" value={row.uom} />
      <DetailField label="ประเภทอ้างอิง" value={row.reference_type} />
      <DetailField label="เลขที่อ้างอิง" value={row.reference_no} />
      <DetailField label="เอกสารอ้างอิง" value={row.source_document_no ?? row.reference_id} />
      <DetailField label="วันที่สร้าง" value={formatDocumentDate(row.created_at)} />
    </>
  );
}

export function MovementLedgerTable({ data = [], loading = false, error = null, grouped = false, groupBy = 'lot' }) {
  const rows = grouped ? annotateGroupedRows(data, groupBy) : data;
  return (
    <CompactExpandableTable
      rows={rows}
      rowKey={(row) => row.id ?? `${row.movement_type}-${row.created_at}-${row.reference_id}`}
      summaryColumns={summaryColumns}
      renderDetail={renderMovementDetail}
      loading={loading}
      error={error}
      emptyMessage="ไม่พบข้อมูลรายการเคลื่อนไหว"
      tableTestId="movement-ledger-table"
      getRowClassName={grouped ? (row) => (row._isLastOfLotGroup ? 'movement-ledger-lot-divider' : undefined) : undefined}
    />
  );
}
