import { DataTable } from '../ui/DataTable.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';

function fmtDate(dateString) {
  if (!dateString || dateString === 'NO_EXPIRY_DATE') return dateString ?? '-';
  return formatDocumentDate(dateString, { dateOnly: true });
}

const columns = [
  { key: 'customer_name', header: 'ลูกค้า', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'product_code', header: 'สินค้า', render: (row) => `${row.product_code ?? '-'}${row.product_name ? ` — ${row.product_name}` : ''}` },
  { key: 'lot_no', header: 'LOT', render: (row) => row.lot_no ?? '-' },
  { key: 'qty_boxes', header: 'ยอดคงเหลือ (กล่อง)', render: (row) => Number(row.qty_boxes ?? 0).toLocaleString() },
  { key: 'qty_weight', header: 'ยอดคงเหลือ (กก.)', render: (row) => formatFixed2(row.qty_weight ?? 0) },
  { key: 'storage_start_date', header: 'วันที่รับเข้า', render: (row) => fmtDate(row.storage_start_date ?? row.received_at) },
  { key: 'aging_days', header: 'อายุจัดเก็บ (วัน)' },
  { key: 'expiry_date', header: 'วันหมดอายุ', render: (row) => fmtDate(row.expiry_date ?? row.exp_date) },
  {
    key: 'remaining_shelf_life_days',
    header: 'อายุสินค้าคงเหลือ (วัน)',
    render: (row) => (row.remaining_shelf_life_days === null || row.remaining_shelf_life_days === undefined) ? '-' : row.remaining_shelf_life_days,
  },
  { key: 'expiry_status', header: 'สถานะหมดอายุ' },
  { key: 'chargeable_days', header: 'จำนวนวันคิดค่าฝาก' },
];

export function StorageAgingTable({ data, loading, error, emptyMessage = 'ไม่พบข้อมูลรายการจัดเก็บสินค้า' }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      emptyMessage={emptyMessage}
    />
  );
}
