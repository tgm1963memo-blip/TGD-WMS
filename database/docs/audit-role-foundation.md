# Audit Log + Role Foundation

Sprint 1C creates the first audit and role foundation for TGD WMS.

## User Role Model

Roles are stored in `tgd_user_profiles.role`.

Allowed roles:

- `ADMIN`
- `MANAGER`
- `WAREHOUSE_SUPERVISOR`
- `WAREHOUSE_STAFF`
- `VIEWER`
- `AUDITOR`

Suggested permissions:

- `ADMIN`: all permissions
- `MANAGER`: view inventory and post inventory movements
- `WAREHOUSE_SUPERVISOR`: view inventory and post inventory movements
- `WAREHOUSE_STAFF`: view inventory and post inventory movements
- `VIEWER`: view inventory only
- `AUDITOR`: view inventory and audit logs

## Audit Log Model

`tgd_audit_logs` records entity-level actions with optional before/after JSON snapshots.

Important fields:

- `entity_type`
- `entity_id`
- `action`
- `old_value`
- `new_value`
- `metadata`
- `performed_by`
- `performed_by_auth_user_id`
- `ip_address`
- `user_agent`
- `request_id`
- `created_at`

The helper function `tgd_write_audit_log(input jsonb)` requires only `entity_type` and `action`. Optional fields may be omitted.

## RLS Foundation

`database/policies/001_rls_foundation.sql` enables row level security for master data, movement data, stock balances, user profiles, and audit logs.

Draft policy groups:

- Inventory view policies for authenticated users who can view inventory
- Movement insert policy for authenticated users who can post movements
- Audit log view policy for `ADMIN` and `AUDITOR`
- User profile self-view policy
- Admin manage user profile policies

This policy file is a foundation draft. Apply and test it in a Supabase environment where `auth.uid()` and the `authenticated` role are available.

## Permission Helper Functions

- `tgd_current_user_role()`
- `tgd_is_admin()`
- `tgd_is_manager_or_admin()`
- `tgd_can_view_inventory()`
- `tgd_can_post_inventory_movement()`
- `tgd_can_view_audit_logs()`

`tgd_current_user_role()` returns the active profile role for `auth.uid()`. If no matching user exists, or if `auth.uid()` is unavailable in a local SQL context, it returns `VIEWER`.

## Audit Usage Pattern

Application and database workflows should write audit entries through `tgd_write_audit_log(input jsonb)` after important create, update, delete, approval, posting, reversal, and permission-sensitive actions.

Audit logging should include the business entity, action name, actor identity, request metadata, and old/new values where useful.

## Intentionally Not Included In Sprint 1C

- User management UI
- Role assignment UI
- Authentication flow
- Receiving, picking, transfer, or adjustment document tables
- Express DBF sync
- Raw Express tables
- Audit triggers on every business table
- Page-level Supabase queries

## Next Sprint Recommendation

Phase 2 should begin with Sprint 2A Receiving, or add a focused hardening sprint for applied RLS validation in Supabase before operational workflows.

