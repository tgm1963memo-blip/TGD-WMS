# Customer Isolation & RLS Refinement

## Purpose
Define the refined Row‑Level Security (RLS) model that enforces **customer‑owned operational data isolation** while respecting role‑based access boundaries for internal and external users.

## Customer Isolation Model
- All operational tables that contain a `customer_id` column must be **filtered** so that a user can see only rows where the `customer_id` matches the user's profile **or** the user holds an internal role with broader permissions.
- `customer_id = NULL` **does NOT** grant global access. Only internal roles explicitly allowed can bypass the customer filter.
customer_id = null does NOT grant global access.
customer‑scoped access requires customer_id match.

## Internal User Model
| Role | Typical Scope |
|------|----------------|
| **admin** | Full read/write across all tables (including admin tables). |
| **warehouse_manager** | Operational read/write across all warehouses, but still respects `customer_id` when applicable. |
| **warehouse_staff** | Operational read/write limited to tasks (receiving, putaway, transfer, adjustment, stock count, withdrawal, allocation, picking, dispatch) but **cannot** modify user profiles or accounting tables. |
| **accounting** | Read‑only access to accounting charge tables, monthly storage snapshots, and can read operational reference data (e.g., products). No write to stock balances or movements. |
| **viewer** | Read‑only across all tables *except* admin‑only tables. When scoped to a customer, only rows matching that `customer_id` are visible.

## Customer‑Scoped User Model
- Users with a **non‑null `customer_id`** in `tgd_user_profiles` are considered *customer‑scoped*.
- Access is limited to rows where `target_table.customer_id = profile.customer_id`.
- Role still dictates **write** capabilities (e.g., a `warehouse_staff` customer‑scoped user can write their own movement rows but cannot modify other customers' data).

## Decision Rules (profile → access)
```sql
-- General guard used in every RLS policy
EXISTS (
  SELECT 1 FROM tgd_user_profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = true
    AND (
      p.role IN ('admin', 'warehouse_manager')
      OR p.customer_id = target_table.customer_id
    )
);
```
- **Admin / warehouse_manager**: `p.role IN ('admin','warehouse_manager')` grants broad access regardless of `customer_id`.
- **Other roles**: Must satisfy `p.customer_id = target_table.customer_id`.

## Missing Profile Behavior
- If no matching row exists in `tgd_user_profiles` for `auth.uid()`, the request is **denied** (policy evaluates to FALSE).

## Inactive Profile Behavior
- `p.is_active = false` forces denial for all tables.

## Unknown Role Behavior
- Any role not listed in the allowed set (`admin`, `warehouse_manager`, `warehouse_staff`, `accounting`, `viewer`) is treated as **no write permission** and **read‑only limited to public reference data**.

## Table Groups
### With `customer_id`
- `tgd_customers` (read‑only for admins only)
- `tgd_products` (reference data – global read)
- `tgd_stock_balances` **protected** – never writable by frontend. Only RPC (future) may modify.
- `tgd_stock_movements` **protected** – write via RPC (future), read via RLS.
- Operational tables: `tgd_receiving_documents`, `tgd_putaway_tasks`, `tgd_transfer_documents`, `tgd_adjustment_documents`, `tgd_stock_count_sessions`, `tgd_withdrawal_requests`, `tgd_allocation_records`, `tgd_picking_tasks`, `tgd_dispatch_documents`.
### Without `customer_id`
- `tgd_user_profiles` (admin only read/write)
- `tgd_warehouses`, `tgd_zones`, `tgd_locations` (global read, internal write for admins/managers).

## Stock Balance Protection
- **Never** allow direct INSERT/UPDATE/DELETE from the frontend.
- Future RPC will be the exclusive path for stock‑balance mutations.

## Movement Ledger Protection
- Writes must be performed through **future RPC** only. RLS restricts reads to matching `customer_id`.

## Accounting Access Boundary
- `tgd_operation_charges`, `tgd_monthly_storage_snapshots`, `tgd_accounting_charge_staging` are **read‑only** for `accounting` role and **admin**.
- No write access for any other role.

## Audit Access Boundary
- Audit tables (e.g., `tgd_audit_logs`) are readable by `admin` and `warehouse_manager` only.
- Customer‑scoped users have no access.

## User Profile Boundary
- `tgd_user_profiles` can be read/managed **only by `admin`**.
- No role (including `warehouse_manager`) may edit other users' profiles.

## Future RPC Dependency
- Stock‑balance and movement writes will be delegated to **RPC functions** (not implemented in this sprint). RLS policies contain a comment indicating this future plan.

## Staging Verification Plan (future)
1. Deploy the refined policies to a **staging Supabase** project.
2. Run integration tests that impersonate users with various roles and `customer_id` values.
3. Verify that:
   - Customer‑scoped users only see their own rows.
   - Admins see all rows.
   - Unauthorized users receive `403`/`permission denied`.
4. Confirm that attempts to write `stock_balances` directly are rejected.

## Known Gaps
- Column‑level RLS for tables that **do not** contain `customer_id` (e.g., product catalog) is not needed now but may be added later for future features.
- Detailed audit logging for RLS decisions is not yet implemented.
- RPC functions for stock‑balance and movement writes are placeholders for a future sprint.
- No UI‑level enforcement; UI must respect the same role model.
Frontend permissions are not final control; RLS is the authoritative enforcement.
---
*Generated by Antigravity.*
