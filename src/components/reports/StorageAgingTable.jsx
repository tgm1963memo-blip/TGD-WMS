import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'customer_id', header: 'ลูกค้า', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'product_id', header: 'สินค้า', render: (row) => row.product_name ?? row.product_id ?? '-' },
  { key: 'lot_id', header: 'ล็อต', render: (row) => row.lot_no ?? row.lot_id ?? '-' },
  { key: 'pallet_id', header: 'พาเลท', render: (row) => row.pallet_no ?? row.pallet_id ?? '-' },
  { key: 'warehouse_id', header: 'คลังสินค้า', render: (row) => row.warehouse_name ?? row.warehouse_id ?? '-' },
  { key: 'room_zone', header: 'ห้อง / โซน', render: (row) => row.room_code ?? row.zone_code ?? '-' },
  { key: 'location_id', header: 'ตำแหน่งจัดเก็บ', render: (row) => row.location_code ? `${row.location_code}${row.location_name ? ' — ' + row.location_name : ''}` : (row.location_id ? row.location_id.slice(0, 8) + '...' : '-') },
  { key: 'condition_status', header: 'สภาพสินค้า', render: (row) => row.condition_status ?? '-' },
  { key: 'qty_on_hand', header: 'ยอดจัดเก็บ' },
  { key: 'uom', header: 'หน่วย' },
  { key: 'storage_start_date', header: 'วันที่รับเข้า', render: (row) => row.storage_start_date ?? row.received_date ?? '-' },
  { key: 'aging_days', header: 'อายุจัดเก็บ (วัน)' },
  { key: 'aging_bucket', header: 'ช่วงอายุ' },
  { key: 'expiry_date', header: 'วันหมดอายุ', render: (row) => row.expiry_date ?? row.exp_date ?? '-' },
  { key: 'expiry_status', header: 'สถานะหมดอายุ' },
  { key: 'chargeable_days', header: 'จำนวนวันคิดค่าฝาก' },
  { key: 'billing_note', header: 'หมายเหตุ', render: () => 'Storage duration review only' },
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
