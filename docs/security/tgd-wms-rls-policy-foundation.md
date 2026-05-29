# tgd-wms-rls-policy-foundation

## Purpose
This document defines the Row Level Security (RLS) policy foundation for the TGD WMS system. It outlines the security model, role definitions, customer isolation strategy, and the high‑level policy groups that will be implemented in the SQL foundation file.

## Role Model
| Role | Description |
|------|-------------|
| **admin** | System administrators who manage configuration, roles, and can perform any operation on all tables. |
| **warehouse_manager** | Managers who oversee warehouse operations, can review and audit records, and have read/write access to most operational data. |
| **warehouse_staff** | Staff members who perform day‑to‑day warehouse tasks (receiving, putaway, transfer, picking, dispatch). |
| **accounting** | Accounting team that reviews charges, storage billing, and related financial data. |
| **viewer** | Read‑only users (e.g., auditors) that can view data but cannot modify anything. |

## Customer Isolation Model
All customer‑owned operational data (e.g., withdrawal requests, allocations) must be isolated by `customer_id`. The `tgd_user_profiles` table links a Supabase `auth.uid()` to a role and optionally to a `customer_id`. Policies will enforce that a user can only see rows where `customer_id` matches the value in their profile.

## Policy Groups
1. **Master Data (Reference tables)** – Admin full access, other roles read‑only.
2. **Operational Data** – Warehouse staff and manager have write access to task status; accounting has read‑only where relevant.
3. **Stock Balance & Movement** – Read‑only for staff, manager, accounting, and viewer. Writes are prohibited; future RPC will handle stock changes.
4. **Accounting Charge Staging** – Accounting can read/write staging records; admin full access.
5. **Audit Logs** – Insert allowed for system actions; read for admin, manager, and accounting.
6. **User Profiles** – Admin can manage; users can read their own profile.

## Table Access Matrix (summary)
| Table | admin | warehouse_manager | warehouse_staff | accounting | viewer |
|-------|-------|-------------------|----------------|------------|--------|
| tgd_customers | READ_WRITE | READ | READ | READ | READ |
| tgd_stock_balances | ADMIN_ONLY | READ | READ | READ | READ |
| ... (full matrix in separate document) |

## Read/Write Boundaries
- **Read** – Allowed for all roles unless explicitly excluded.
- **Insert / Update** – Restricted to roles that own the workflow (e.g., staff for task status, accounting for charge staging).
- **Delete** – Not permitted in this sprint; future sprints may define soft‑delete mechanisms.

## Admin Responsibilities
- Maintain RLS policies and keep them in sync with role definitions.
- Ensure no `service_role` key is ever exposed to the frontend.
- Review policy changes before applying to a live Supabase instance.

## Accounting Access Boundaries
- Access to `tgd_accounting_charge_staging`, `tgd_monthly_storage_snapshots`, and read‑only operational reference data.
- No write access to stock tables.

## Warehouse Staff Access Boundaries
- Can read operational tables and update task status fields.
- No direct write to stock balances or movements.

## Warehouse Manager Access Boundaries
- Full read/write on operational tables, audit capabilities, and read access to stock tables.

## Viewer Read‑Only Rule
- Can only execute `SELECT` statements on all tables.

## Service‑Role Warning
- The frontend **must** use the anon key only. The `service_role` key must never be used in the UI or client‑side code.

## Future Test Plan
- Unit tests will validate that the SQL file contains the required `ENABLE ROW LEVEL SECURITY` statements and role‑based policies.
- Integration tests will simulate auth.uid() mapping via `tgd_user_profiles`.

## Known Gaps
- Actual role‑to‑user mapping implementation is deferred to a later sprint.
- Detailed column‑level policies are not defined yet; this sprint provides table‑level foundations only.
