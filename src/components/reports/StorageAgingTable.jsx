import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'customer_id', header: 'ลูกค้า', render: (row) => row.customer_name ?? row.customer_id ?? '-' },
  { key: 'product_id', header: 'สินค้า', render: (row) => row.product_name ?? row.product_id ?? '-' },
  { key: 'location_id', header: 'ตำแหน่งจัดเก็บ', render: (row) => row.location_code ?? row.location_id ?? '-' },
  { key: 'qty_on_hand', header: 'ยอดจัดเก็บ' },
  { key: 'uom', header: 'หน่วย' },
  { key: 'storage_start_date', header: 'วันที่รับเข้า', render: (row) => {
      const dateString = row.storage_start_date ?? row.received_date;
      if (!dateString) return '-';
      const d = new Date(dateString);
      return Number.isNaN(d.getTime()) ? dateString : d.toLocaleDateString('th-TH');
  }},
  { key: 'aging_days', header: 'อายุจัดเก็บ (วัน)' },
  { key: 'expiry_date', header: 'วันหมดอายุ', render: (row) => {
      const dateString = row.expiry_date ?? row.exp_date;
      if (!dateString || dateString === 'NO_EXPIRY_DATE') return dateString ?? '-';
      const d = new Date(dateString);
      return Number.isNaN(d.getTime()) ? dateString : d.toLocaleDateString('th-TH');
  }},
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
