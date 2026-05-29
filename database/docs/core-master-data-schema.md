# Core Master Data Schema

Sprint 1A creates the master-data foundation for TGD WMS. All new tables use the `tgd_` prefix and are designed for Supabase/PostgreSQL.

## Tables

### `tgd_customers`

Purpose: Stores customer master records.

Key fields: `customer_code`, `customer_name`, contact details, `is_active`.

Relationships: Referenced by future customer-isolated operational records.

### `tgd_products`

Purpose: Stores product/SKU master records.

Key fields: `product_code`, `product_name`, `barcode`, `base_uom`, storage and temperature attributes, lot/expiry control flags.

Relationships: Referenced by `tgd_lots` and future inventory movement records.

### `tgd_warehouses`

Purpose: Stores warehouse master records.

Key fields: `warehouse_code`, `warehouse_name`, `warehouse_type`, `address`, `is_active`.

Relationships: Parent of `tgd_zones`.

### `tgd_zones`

Purpose: Stores warehouse zones.

Key fields: `warehouse_id`, `zone_code`, `zone_name`, `temperature_type`, `is_active`.

Relationships: Belongs to `tgd_warehouses`; parent of `tgd_rooms`.

### `tgd_rooms`

Purpose: Stores room-level storage areas inside zones.

Key fields: `zone_id`, `room_code`, `room_name`, `temperature_min`, `temperature_max`, `is_active`.

Relationships: Belongs to `tgd_zones`; parent of `tgd_locations`.

### `tgd_locations`

Purpose: Stores physical storage and pick-face locations.

Key fields: `room_id`, `location_code`, `location_name`, `location_type`, `barcode`, `is_pick_face`, `is_active`.

Relationships: Belongs to `tgd_rooms`; referenced by `tgd_pallets` and future movement records.

### `tgd_pallets`

Purpose: Stores pallet master records and current assigned location reference.

Key fields: `pallet_code`, `barcode`, `current_location_id`, `pallet_type`, `is_active`.

Relationships: Optionally references `tgd_locations`.

### `tgd_lots`

Purpose: Stores product lot/batch identity.

Key fields: `product_id`, `lot_no`, `mfg_date`, `exp_date`, `received_date`, `supplier_lot_no`, `is_active`.

Relationships: Belongs to `tgd_products`; referenced by future inventory movement records.

## Barcode Readiness

Product, location, and pallet records include barcode fields or barcode-ready identifiers. Location barcodes use a partial unique index where `barcode is not null`, allowing locations without barcodes while preventing duplicate scanned values.

## Customer Isolation Note

Sprint 1A creates customer master data but does not yet attach stock, movements, orders, or balances to customers. Future operational tables must include customer isolation explicitly, and customer-owned inventory must not be inferred only from product, lot, location, or pallet.

## Intentionally Not Included In Sprint 1A

- Movement ledger tables
- Stock balance tables or balance engine
- Receiving, putaway, picking, transfer, or adjustment workflow tables
- Audit log tables
- Role and permission tables
- Express DBF sync tables or code
- React CRUD screens or Supabase page queries

