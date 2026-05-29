import { StorageAgingTable } from './StorageAgingTable.jsx';

export function ExpiryAlertTable({ data, loading, error }) {
  return (
    <StorageAgingTable
      data={data}
      loading={loading}
      error={error}
      emptyMessage="No near-expiry or expired customer-owned lots found."
    />
  );
}
