// tests/unit/route-permission-audit.test.js

const { ROUTE_PERMISSION_CATALOG, validateRoutePermissionCatalog } = require('../../src/security/routePermissionCatalog');
const {
  auditRoutePermissionCatalog,
  findUncatalogedRoutes,
  findDuplicatePermissionEntries,
  findRoutesWithUnknownPermissionArea,
  findRoutesWithMissingMinimumRole,
  summarizeRoutePermissionAudit,
} = require('../../src/security/routePermissionAuditService');

const APP_ROUTES = [
  '/dashboard',
  '/dashboard/inventory',
  '/master/customers',
  '/operations/receiving',
  '/operations/receiving/:id',
  '/operations/withdrawal-requests',
  '/operations/withdrawal-requests/new',
  '/operations/withdrawal-requests/:id',
  '/inventory',
  '/handheld',
  '/reports',
  '/reports/movement-ledger',
  '/reports/customer-storage-balance',
  '/reports/storage-aging',
  '/reports/warehouse-operation-performance',
  '/reports/monthly-storage-billing-summary',
  '/reports/accounting-charge-staging-preview',
  '/reports/accounting-charge-handoff-review',
  '/reports/billing-movement-weight',
  '/billing/invoice-drafts',
  '/billing/invoice-drafts/:draftId',
  '/admin/auth-readiness',
  '/admin/users',
  '/admin/warehouse-locations',
  '/admin/customer-products',
  '/admin/customer-request-policy',
  '/admin/product-service-rates',
  '/admin/role-permissions',
  '/settings/profile',
  '/settings/email',
  '/settings/change-password',
  '/customer',
  '/customer/deposit-request',
  '/customer/deposit-request/new',
  '/customer/deposit-request/:requestId',
  '/customer/stock-balance',
  '/customer/withdrawal-request',
  '/customer/withdrawal-request/new',
  '/customer/withdrawal-request/:requestId',
  '/customer/requests',
  '/customer/facility-usage',
  '/customer/admin/deposit-review',
  '/customer/admin/deposit-review/:requestId',
  '/customer/admin/withdrawal-review',
];

const VALID_AREAS = [
  'master_data', 'receiving', 'withdrawal', 'reports',
  'accounting_review', 'admin', 'user_management', 'customer_catalog', 'customer_portal',
];
const VALID_ROLES = ['admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting', 'viewer', 'customer_admin', 'customer_user'];
const VALID_ACCESS = ['read', 'write', 'review', 'admin'];

test('ROUTE_PERMISSION_CATALOG is defined and non‑empty', () => {
  expect(Array.isArray(ROUTE_PERMISSION_CATALOG)).toBe(true);
  expect(ROUTE_PERMISSION_CATALOG.length).toBeGreaterThan(0);
});

test('All catalog entries have required fields with valid values', () => {
  for (const entry of ROUTE_PERMISSION_CATALOG) {
    expect(typeof entry.route_path).toBe('string');
    expect(entry.route_path.length).toBeGreaterThan(0);
    expect(typeof entry.route_name).toBe('string');
    expect(VALID_AREAS).toContain(entry.permission_area);
    expect(VALID_ROLES).toContain(entry.minimum_role);
    expect(VALID_ACCESS).toContain(entry.access_level);
  }
});

test('validateRoutePermissionCatalog returns no errors', () => {
  expect(validateRoutePermissionCatalog()).toEqual([]);
});

test('auditRoutePermissionCatalog reports clean catalog', () => {
  const audit = auditRoutePermissionCatalog(APP_ROUTES, ROUTE_PERMISSION_CATALOG);
  expect(audit.uncatalogedRoutes).toEqual([]);
  expect(audit.duplicateEntries).toEqual([]);
  expect(audit.unknownAreaEntries).toEqual([]);
  expect(audit.missingRoleEntries).toEqual([]);
});

test('findUncatalogedRoutes returns empty for APP_ROUTES', () => {
  expect(findUncatalogedRoutes(APP_ROUTES, ROUTE_PERMISSION_CATALOG)).toEqual([]);
});

test('findDuplicatePermissionEntries returns empty', () => {
  expect(findDuplicatePermissionEntries(ROUTE_PERMISSION_CATALOG)).toEqual([]);
});

test('findRoutesWithUnknownPermissionArea returns empty', () => {
  expect(findRoutesWithUnknownPermissionArea(ROUTE_PERMISSION_CATALOG)).toEqual([]);
});

test('findRoutesWithMissingMinimumRole returns empty', () => {
  expect(findRoutesWithMissingMinimumRole(ROUTE_PERMISSION_CATALOG)).toEqual([]);
});

test('summarizeRoutePermissionAudit includes clean summary', () => {
  const summary = summarizeRoutePermissionAudit(auditRoutePermissionCatalog(APP_ROUTES, ROUTE_PERMISSION_CATALOG));
  expect(summary).toContain('Uncataloged routes (0)');
});
