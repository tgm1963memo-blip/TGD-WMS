# Sprint 13H – Stock Balance Trigger Design Validation

**Trigger SQL file:** `database/triggers/006_tgd_wms_stock_balance_trigger_design.sql` – **Prepared only** (not applied).

**Live Supabase apply:** Not executed.

**Real Supabase Auth users:** Not created.

**User profile writes:** Not executed.

**Seed data apply:** Not executed.

**RPC apply:** Not executed (trigger depends on RPC but RPC not executed in this sprint).

**UI data connection:** Not implemented.

**Real transaction writes:** Not implemented.

## Schema verification
- `tgd_stock_balances` columns (from `001_tgd_wms_schema_foundation.sql`):
  - `id`, `customer_id`, `product_id`, `lot_id`, `location_id`, `quantity`, `weight`, `last_movement_id`, `created_at`, `updated_at`.
- **Missing columns**: `warehouse_id`, `pallet_id` are **not present** in current schema.

**Known gap / future schema requirement**: If future migrations add `warehouse_id` and/or `pallet_id` to `tgd_stock_balances`, the trigger UPSERT key must be extended accordingly.

---

*Prepared only – do NOT apply to any environment without Controller approval.*
