import { DataTable } from '../ui/DataTable.jsx';

const columns = [
  { key: 'created_at', header: 'Movement Date' },
  { key: 'movement_type', header: 'Movement Type' },
  { key: 'product_id', header: 'Product' },
  { key: 'customer_id', header: 'Customer' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'from_warehouse_id', header: 'Source Warehouse' },
  { key: 'to_warehouse_id', header: 'Target Warehouse' },
  { key: 'from_location_id', header: 'Source Location' },
  { key: 'to_location_id', header: 'Target Location' },
  { key: 'from_pallet_id', header: 'Source Pallet' },
  { key: 'to_pallet_id', header: 'Target Pallet' },
  { key: 'qty', header: 'Qty' },
  { key: 'uom', header: 'UOM' },
  { key: 'reference_type', header: 'Reference Type' },
  { key: 'reference_id', header: 'Reference ID' },
  { key: 'created_by', header: 'Created By' },
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
