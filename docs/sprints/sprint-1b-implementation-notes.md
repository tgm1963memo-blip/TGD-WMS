# Sprint 1B Implementation Notes

## What Was Created

- `database/migrations/002_inventory_movement_engine.sql`
- `database/docs/inventory-movement-engine.md`
- `src/constants/movementTypes.js`
- `src/services/inventoryMovementService.js`
- `tests/unit/inventory-movement-schema.test.js`

## Database Objects

- `tgd_inventory_movements`
- `tgd_stock_balances`
- `tgd_post_inventory_movement(input jsonb)`
- Stock helper functions for increase, decrease, allocation, deallocation, and pick confirmation
- Stock-balance write guard trigger

## Movement-Ledger Rule

Inventory movement rows are the source of truth. Stock balance rows are only snapshots and are protected from direct writes by a database trigger.

## Stock Balance Rule

The posting function inserts a movement and updates affected balances in one database transaction. If any validation fails, PostgreSQL rolls back the movement insert and stock-balance changes together.

## Nullable Lot/Pallet Strategy

Stock balance uniqueness uses a unique expression index with `coalesce(lot_id, sentinel_uuid)` and `coalesce(pallet_id, sentinel_uuid)` so duplicate rows cannot be created when either value is null.

## What Was Intentionally Not Created

- No receiving document tables
- No picking document tables
- No transfer document tables
- No adjustment document tables
- No Express sync
- No raw Express tables
- No React UI business logic
- No Supabase queries inside pages
- No legacy file changes

## Migration Application Notes

Apply `001_core_master_data.sql` before `002_inventory_movement_engine.sql`. The Sprint 1B migration depends on the Sprint 1A master tables and foreign keys.

The function is intended to be called through Supabase RPC as `tgd_post_inventory_movement`.

## Next Sprint

Sprint 1C Audit Log + Role Foundation.

