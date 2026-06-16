# User Management + Customer Product Catalog

## Overview

Two features shipped as migrations **045** and **046** with matching frontend pages:

| Feature | Migration | Admin UI | Customer UI |
|---------|-----------|----------|-------------|
| User Management | `045_tgd_wms_user_management_admin_rpc.sql` | `/admin/users` | — |
| Customer Product Catalog | `046_tgd_wms_customer_product_catalog.sql` | `/admin/customer-products` | `/customer/products` |

**DRAFT ONLY** — apply to UAT/Production only with Controller approval.

## User Management (045)

### Workflow

1. Create the login account in **Supabase Auth** (Dashboard → Authentication).
2. Open **User Management** (`/admin/users`) as `admin`.
3. Create profile: email, role, optional `customer_id` for `customer_admin` / `customer_user`.
4. Paste `auth_user_id` (UUID from Auth) to link login → profile.
5. Toggle active/inactive without deleting rows.

### RPCs

- `tgd_admin_upsert_user_profile` — create/update profile metadata
- `tgd_admin_set_user_profile_active` — activate/deactivate

### RLS addition

- `rls_user_profiles_self_read` — any authenticated user can `SELECT` their own row (`auth_user_id = auth.uid()`).

Does **not** create `auth.users` from the frontend.

## Customer Product Catalog (046)

### Table

`tgd_customer_products` — per-customer product codes:

- `customer_product_code` (unique per customer)
- `product_name`, `internal_product_code`, `internal_product_id`, `uom`, `temperature_type`
- soft deactivate via `is_active`

### RPCs

- `tgd_upsert_customer_product` — `customer_admin`/`customer_user` (own scope) or `admin` (any customer)
- `tgd_deactivate_customer_product` — soft delete

### Deposit / Withdrawal forms

`CustomerProductPicker` on deposit and withdrawal pages loads active catalog rows and auto-fills product fields. Manual entry remains available.

## Routes & permissions

| Route | Minimum role |
|-------|----------------|
| `/admin/users` | `admin` |
| `/admin/customer-products` | `admin` |
| `/customer/products` | `customer_user` (write: `customer_admin`/`customer_user` with `customer_id`) |

## Apply migrations (UAT)

```bash
# After Controller approval — example using psql or Supabase SQL editor
# 1. 045_tgd_wms_user_management_admin_rpc.sql
# 2. 046_tgd_wms_customer_product_catalog.sql
```

## Test checklist

- [ ] Admin lists/creates/edits user profiles
- [ ] Customer user reads own profile after 045 self-read policy
- [ ] Customer adds catalog product at `/customer/products`
- [ ] Deposit form picker fills product fields from catalog
- [ ] Withdrawal form picker fills product fields from catalog
- [ ] Admin filters catalog by customer at `/admin/customer-products`
