import { StorageAgingTable } from './StorageAgingTable.jsx';

export function ExpiryAlertTable({ data, loading, error }) {
  return (
    <StorageAgingTable
      data={data}
      loading={loading}
      error={error}
      emptyMessage="ไม่พบสินค้าใกล้หมดอายุหรือหมดอายุแล้ว"
    />
  );
}
