# Database Migration README

## Purpose
This migration defines the **foundation** of the TGD WMS Supabase database schema. It includes master data tables, stock foundation, inbound/outbound processes, billing/accounting hand‑off, and audit/security tables.

## Important Conditions
- **Do NOT execute** this migration against a production Supabase instance **until the Controller reviews and approves** it.
- This sprint **does not include** Row‑Level Security (RLS) policies or RPC functions. Those will be added in future sprints.
- No UI table reads/writes, receiving, picking, dispatch, stock‑balance mutation logic, invoice generation, ERP posting, or Express sync are implemented.
- The migration is safe to run on a **development** or **staging** Supabase project for validation purposes only.

## How to Apply Manually
1. Open the Supabase dashboard and navigate to **SQL editor**.
2. Copy the contents of `database/migrations/001_tgd_wms_schema_foundation.sql` into the editor.
3. Click **Run**.

## Rollback (if needed)
- To revert, you would need to manually drop the tables created. A rollback script is **not provided** in this sprint because the migration is not meant for production yet.

## Next Steps
- **Sprint 13C** will add **RLS policies** and **RPC functions** for stock‑changing actions.
- Future migrations will introduce triggers to keep `tgd_stock_balances` in sync with `tgd_stock_movements`.

---
*Prepared for Controller review. No live Supabase migration has been executed.*
