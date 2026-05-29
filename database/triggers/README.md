# Triggers Directory README

## Purpose
This directory contains **prepared** trigger definitions for the TGD WMS database. All files are *prepared only* and must **not** be applied to any Supabase instance until explicit Controller approval.

## Dependencies
- **Schema Migration**: Requires the base schema defined in `database/migrations/001_tgd_wms_schema_foundation.sql` (tables `tgd_stock_balances` and `tgd_stock_movements`).
- **RPC Stock Movement Foundation**: Relies on the RPC layer from Sprint 13G (`database/rpc/005_tgd_wms_rpc_stock_movement_foundation.sql`) which validates and inserts rows into `tgd_stock_movements`.
- **RLS / Customer Isolation**: The trigger respects Row‑Level Security policies defined in Sprint 13C; it operates on the underlying tables after RLS checks have passed.

## Prepared‑Only Warning
> **Prepared only.** These trigger scripts are **not** to be executed in production or staging environments until a Controller review clears them.

## Do Not Execute in Production
Running these triggers without proper review could corrupt inventory snapshots. Ensure the Controller has signed off before any `psql` execution.

---

## Trigger Design Summary
- **Function**: `public.tgd_trigger_update_stock_balance()` – SECURITY DEFINER, performs an UPSERT on `tgd_stock_balances` using the composite key `(customer_id, product_id, lot_id, location_id)`.
- **Trigger**: `tgd_after_insert_stock_movement` – AFTER INSERT on `tgd_stock_movements`, fires the function for each new row.
- **Search Path**: Locked to `public` at the start of the script.

## Balance Key Summary
| Column | Source | Description |
|--------|--------|-------------|
| `customer_id` | `tgd_stock_movements.customer_id` | Identifier for the customer owning the stock |
| `product_id`  | `tgd_stock_movements.product_id`  | Product reference |
| `lot_id`      | `tgd_stock_movements.lot_id`      | Specific lot of the product |
| `location_id` | `tgd_stock_movements.to_location_id` | Target location after movement |
| `quantity`    | `tgd_stock_movements.quantity`    | Quantity to add/subtract |

## Movement Effect Summary
- Each INSERT into `tgd_stock_movements` adds the movement `quantity` to the existing balance row (or creates a new row if none exists).
- No subtraction logic is required because negative quantities are recorded directly in the movement row when appropriate.

## Rollback Note
If a migration is mistakenly applied, you can drop the trigger and function with:
```sql
DROP TRIGGER IF EXISTS tgd_after_insert_stock_movement ON tgd_stock_movements;
DROP FUNCTION IF EXISTS public.tgd_trigger_update_stock_balance();
```

## Future Staging Validation Plan (Sprint 13I)
- Apply the trigger in a staging Supabase instance.
- Run integration tests that insert sample movements via RPC and verify `tgd_stock_balances` reflects the correct snapshots.
- Add audit‑log entries for each balance change.

---

*Prepared only – do NOT apply to any environment without Controller sign‑off.*
