# Sprint 1C Implementation Notes

## What Was Created

- `database/migrations/003_audit_role_foundation.sql`
- `database/policies/001_rls_foundation.sql`
- `database/docs/audit-role-foundation.md`
- `src/constants/userRoles.js`
- `src/services/auditService.js`
- `src/services/userProfileService.js`
- `tests/unit/audit-role-schema.test.js`

## User Role Model

Sprint 1C defines these roles:

- `ADMIN`
- `MANAGER`
- `WAREHOUSE_SUPERVISOR`
- `WAREHOUSE_STAFF`
- `VIEWER`
- `AUDITOR`

The role is stored in `tgd_user_profiles.role` and constrained at the database level.

## Audit Log Model

`tgd_audit_logs` stores entity actions with optional JSON snapshots, actor identifiers, request metadata, and timestamps.

The `tgd_write_audit_log(input jsonb)` helper inserts audit rows and returns the created audit log id.

## RLS Foundation

The policy draft enables RLS on master, inventory, stock, user profile, and audit tables. It includes draft policies for inventory viewing, movement insertion, audit log viewing, self profile viewing, and admin user profile management.

## Permission Helper Functions

- `tgd_current_user_role()`
- `tgd_is_admin()`
- `tgd_is_manager_or_admin()`
- `tgd_can_view_inventory()`
- `tgd_can_post_inventory_movement()`
- `tgd_can_view_audit_logs()`

## What Was Intentionally Not Created

- No user management UI
- No authentication UI
- No receiving document tables
- No picking document tables
- No transfer document tables
- No Express sync
- No raw Express tables
- No React page business logic
- No changes to legacy reference files

## Migration Application Notes

Apply Sprint 1A and Sprint 1B migrations before Sprint 1C. The user profile table uses the shared `set_updated_at()` trigger function from Sprint 1A.

Apply `database/policies/001_rls_foundation.sql` only after validating the helper functions in the target Supabase environment.

## Next Sprint Recommendation

Sprint 2A Receiving, with audit events and role checks applied through the foundation created here.

