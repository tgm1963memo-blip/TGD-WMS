# Inventory Movement Engine

Sprint 1B creates the movement-ledger and stock-balance foundation for TGD WMS.

## Movement-Ledger Principle

`tgd_inventory_movements` is the source of truth. Every stock-changing event must create an immutable movement row. Stock balance rows are never the business source of truth.

## Stock-Balance Principle

`tgd_stock_balances` is a calculated/current snapshot for fast lookup. It is updated only by `tgd_post_inventory_movement(input jsonb)` in the same database transaction that inserts the movement row.

A guard trigger rejects direct inserts, updates, and deletes against `tgd_stock_balances` unless the posting function enables the local database write flag.

## Movement Type Behavior

- `OPENING_BALANCE`: increases `qty_on_hand` at the target warehouse/location/pallet.
- `RECEIVE`: increases `qty_on_hand` at the target warehouse/location/pallet.
- `PUTAWAY`: decreases source stock and increases target stock.
- `TRANSFER`: decreases source stock and increases target stock.
- `ADJUST_IN`: increases `qty_on_hand` at the target warehouse/location/pallet.
- `ADJUST_OUT`: decreases source `qty_on_hand`; rejects insufficient available stock.
- `PICK_ALLOCATE`: increases source `qty_allocated`; rejects insufficient available stock.
- `PICK_CONFIRM`: decreases source `qty_on_hand` and `qty_allocated`; rejects insufficient allocated quantity.
- `RETURN_IN`: increases `qty_on_hand` at the target warehouse/location/pallet.
- `REVERSE`: inserts a new reverse movement, marks the original movement as reversed, and applies the inverse stock impact.

## Reverse Movement Rule

Reverse movements never delete the original movement. Sprint 1B supports full-quantity reversal of supported movement types. Partial reversal is intentionally deferred so the first engine remains predictable and auditable.

Reverse movements cannot themselves be reversed.

## Customer Isolation

Both `tgd_inventory_movements` and `tgd_stock_balances` require `customer_id`. Stock identity includes customer, product, lot, warehouse, location, and pallet. This prevents one customer's inventory from being merged with another customer's inventory even when products, lots, locations, or pallets are shared.

## Nullable Lot/Pallet Unique Strategy

PostgreSQL unique constraints treat `NULL` values as distinct, so a plain unique constraint over nullable `lot_id` and `pallet_id` would allow duplicate stock-balance rows.

Sprint 1B uses a PostgreSQL-compatible unique expression index:

```sql
create unique index tgd_stock_balances_identity_unique_idx
on tgd_stock_balances (
  customer_id,
  product_id,
  coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
  warehouse_id,
  location_id,
  coalesce(pallet_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
```

This treats missing lot and pallet values as a stable sentinel only for uniqueness comparison.

## Intentionally Not Included In Sprint 1B

- Receiving document tables or UI
- Picking document tables or UI
- Transfer document tables or UI
- Adjustment document workflow
- Audit log tables
- Role and permission tables
- Express DBF sync
- Raw Express tables
- React page queries or UI business logic
- Partial movement reversal

## Next Sprint Recommendation

Sprint 1C Audit Log + Role Foundation.

