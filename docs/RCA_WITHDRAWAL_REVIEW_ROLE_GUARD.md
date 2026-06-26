# RCA: Withdrawal Review Role Guard (Defect A)

## 1. Root Cause
The `warehouse_staff` role is prevented from accessing the `/customer/admin/withdrawal-review` page because of frontend route definitions and middleware guards.

Specifically:
1. `src/security/routePermissionCatalog.js` defines `/customer/admin/withdrawal-review` with `minimum_role: 'warehouse_admin'`.
2. `src/security/warehouseRolePermissions.js` strictly groups `/customer/admin/withdrawal-review` under `WAREHOUSE_ADMIN_ROUTE_PREFIXES`, meaning the `canWarehouseRoleAccessRoute` function returns `false` for `warehouse_staff`.

Because the React frontend intercepts the navigation, the user is redirected or blocked before they can even render the UI, rendering the Playwright test (which tries to click "Reject" to test the database RPC guard) unable to proceed.

## 2. Evidence
- **Route Catalog**:
  ```javascript
  { route_path: '/customer/admin/withdrawal-review', ..., minimum_role: 'warehouse_admin' }
  ```
- **Permission Matrix**: Migration 007 specifies that `warehouse_staff` should be allowed to execute `SEND_TO_PICKING` and `CONFIRM_DISPATCH` decisions. This implies they have a legitimate business need to view the Withdrawal Review page, supporting **Option B** (warehouse_staff may view the page but cannot approve/reject).

## 3. Files Involved
- `src/security/routePermissionCatalog.js`
- `src/security/warehouseRolePermissions.js`
- `tests/e2e/post-uat-01-withdrawal-picking-flow.spec.js` (Test 09)

## 4. Risk Level
**Medium.** Operations staff may be blocked from transitioning withdrawal requests to "Picking" or "Dispatch" states via the Web UI if they rely on this page instead of the Handheld scanner.

## 5. Recommended Fix
1. In `src/security/routePermissionCatalog.js`, change `minimum_role: 'warehouse_admin'` to `minimum_role: 'warehouse_staff'` for `/customer/admin/withdrawal-review`.
2. In `src/security/warehouseRolePermissions.js`, move `/customer/admin/withdrawal-review` from `WAREHOUSE_ADMIN_ROUTE_PREFIXES` to `WAREHOUSE_STAFF_ROUTE_PREFIXES` or a shared prefix array.
3. Ensure the React UI components (`CustomerAdminWithdrawalReviewPage.jsx` or similar) hide the "Accept" and "Reject" buttons for `warehouse_staff` users to prevent visual clutter, relying on the robust DB RPC to block any malicious direct API calls.

## 6. Estimated Effort
**Low** (~30 minutes). It requires minimal changes to two configuration arrays and a quick validation of the button visibility logic in the UI component.

## 7. Classification
**UI Defect / Configuration Defect.** The intended business logic (from the DB migration matrix) allows staff to perform dispatch workflows, but the frontend route catalog is overly restrictive.
