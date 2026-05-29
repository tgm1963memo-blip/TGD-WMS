# RPC Directory README

## Purpose

This `rpc` directory contains **prepared** Supabase Remote Procedure Call (RPC) functions that encapsulate all stock‑movement write operations for TGD WMS. The RPC layer is the sole authorized gateway for inserting rows into the `tgd_stock_movements` ledger.

## Dependencies

- **Schema migration** – the tables `tgd_stock_movements`, `tgd_user_profiles`, `tgd_audit_logs`, and related foreign‑key tables must exist (provided by earlier schema sprints).
- **RLS Foundation** – row‑level security rules defined in Sprint 13F ensure that only authorized users can read the tables. The RPC functions add a second layer of write protection.
- **Auth Role Mapping** – users must have a profile in `tgd_user_profiles` with a valid role (`admin`, `warehouse_manager`, `warehouse_staff`).
- **Seed Data** – sample user profiles and movement types should be present for testing (provided by Sprint 13E).

## Prepared‑Only Warning

> **Prepared only.** The SQL in this directory is **not** executed against any Supabase instance until a Controller explicitly approves and applies it to a staging environment. Do **not** run these scripts in production.

## What is **NOT** Implemented in this Sprint

- No `CREATE TRIGGER` statements – trigger for updating `tgd_stock_balances` will be added in Sprint 13H.
- No actual audit‑log `INSERT` – placeholder comment left for future implementation.
- No stock‑balance auto‑update logic.
- No UI live‑write integration – front‑end must call these RPCs via Supabase client libraries.
- No use of `service_role` keys in front‑end code.

## Future Sprint 13H Relationship

Sprint 13H will introduce:
- A trigger on `tgd_stock_movements` that updates `tgd_stock_balances`.
- Full audit‑log insertion implementation.
- Additional validation or compensation logic as needed.

## Rollback Note

If this RPC set needs to be removed, drop the functions using:
```sql
DROP FUNCTION IF EXISTS public.tgd_rpc_create_stock_movement(text, uuid, numeric, uuid, uuid, text);
-- also drop the wrapper functions
DROP FUNCTION IF EXISTS public.tgd_rpc_create_receive_movement(uuid, numeric, uuid, uuid, text);
-- etc.
```
Ensure any dependent code is also removed before rolling back.
