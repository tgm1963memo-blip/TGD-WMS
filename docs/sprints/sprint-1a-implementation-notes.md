# Sprint 1A Implementation Notes

## What Was Created

- `database/migrations/001_core_master_data.sql`
- `database/docs/core-master-data-schema.md`
- `tests/unit/schema-files.test.js`

Sprint 1A establishes only the core master-data database foundation for TGD WMS.

## Table List

- `tgd_customers`
- `tgd_products`
- `tgd_warehouses`
- `tgd_zones`
- `tgd_rooms`
- `tgd_locations`
- `tgd_pallets`
- `tgd_lots`

## What Was Intentionally Not Created

- No movement ledger table
- No stock balance table
- No receiving logic
- No picking logic
- No transfer logic
- No adjustment logic
- No Express DBF sync
- No React CRUD UI
- No Supabase queries from pages
- No legacy file changes

## Migration Application Notes

The migration is written for PostgreSQL/Supabase style SQL.

It enables `pgcrypto` for `gen_random_uuid()`, creates a shared `set_updated_at()` trigger function, creates all eight master tables, adds foreign keys, adds uniqueness rules, adds useful indexes, and attaches `updated_at` triggers to every master table.

Apply this migration through the normal Supabase migration process for the project environment. Review existing database state before applying to any shared database.

## Next Sprint

Sprint 1B Movement Ledger + Stock Balance Engine.

