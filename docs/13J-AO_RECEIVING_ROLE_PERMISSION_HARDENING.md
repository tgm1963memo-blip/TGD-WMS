# 13J-AO Receiving Role & Permission Hardening

## 1. Current Role Model Discovered
The frontend application uses a mock/demo role hierarchy found in `src/security/permissionGuard.js` with the following levels:
1. `viewer`
2. `warehouse_staff`
3. `accounting`
4. `warehouse_manager`
5. `admin`

Roles are injected into the frontend via a demo state manager (`src/security/currentUserRole.js`) that defaults to `admin` for testing purposes and can be switched dynamically in the UI.

## 2. Frontend Permission Behavior
We implemented conditional checks based on `hasRoleAccess(userRole, 'warehouse_staff')`.
Any user with `warehouse_staff` privileges or higher can execute write actions. The `viewer` role is actively restricted.

### ReceivingListPage
- **Create Receiving Draft:** The button is completely hidden from `viewer` roles.

### ReceivingCreatePage
- **Page Access:** If a `viewer` attempts to access this page, the entire form is blocked and an "Authentication required. Permission denied." alert is displayed.

### ReceivingDetailPage
- **Confirm/Post Button:** The "Confirm/Post" action is hidden from `viewer` roles. An explicit "Confirm/Post is restricted" message is shown.

## 3. Backend RPC Privilege Expectations
The existing backend design expects the following security posture:
- **Anonymous Users:** Should be rejected at the API/Supabase level before the RPC logic is evaluated.
- **Authenticated Users:** RPC execution is restricted via Supabase RLS and function grants.
- **RPC Wrappers:** The frontend uses wrapper functions in `src/services/receivingService.js`. If an RPC rejects a request with an authentication or permission error (e.g., missing JWT, row-level security violation), the UI gracefully traps and maps these errors to user-friendly messages using `normalizeReceivingError()`.

## 4. What is Verified by Tests
New automated tests (`tests/unit/receiving-role-permission-hardening.test.jsx`) verify that:
- A user with the `viewer` role cannot see the "Create Receiving Draft" button.
- A user with the `viewer` role is completely blocked from the `ReceivingCreatePage`.
- A user with the `viewer` role cannot see the "Confirm/Post" button on the `ReceivingDetailPage`.
- When an authorized role attempts an action, if the backend RPC returns an authentication or permission error (e.g. `JWT token is missing or invalid` or `new row violates row-level security policy`), the UI handles it gracefully and displays a clear error alert.

## 5. Production Readiness Gaps
- **Frontend Role injection:** The application is currently using `src/security/currentUserRole.js` for demoing roles. A real production implementation linking Supabase Auth JWT claims (or a dedicated profile table) to the UI role context will need to be developed and integrated.
- **Supabase Grants:** While the frontend is guarded, proper PostgreSQL `GRANT` and RLS configurations mapping to actual JWT claims will need to be verified on the production database to prevent direct API manipulation.

## 6. Safety Statement
- **No Production Touched:** All checks and changes are scoped strictly to frontend components and mock configurations on Staging.
- **Read-Only:** No SQL migrations were applied. Database functions were only inspected implicitly through existing code boundaries.
