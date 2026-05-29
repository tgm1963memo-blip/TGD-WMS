// tests/unit/route-permission-audit.test.js

/**
 * Unit tests for route permission catalog and audit service.
 * These tests verify that the catalog matches the known routes,
 * that there are no duplicate entries, and that entries use valid
 * permission areas, roles, and access levels.
 */

const { ROUTE_PERMISSION_CATALOG, validateRoutePermissionCatalog } = require('../../src/security/routePermissionCatalog');
const {
  auditRoutePermissionCatalog,
  findUncatalogedRoutes,
  findDuplicatePermissionEntries,
  findRoutesWithUnknownPermissionArea,
  findRoutesWithMissingMinimumRole,
  summarizeRoutePermissionAudit,
} = require('../../src/security/routePermissionAuditService');

// Static list of all route paths defined in src/app/routes.jsx (extracted manually).
const APP_ROUTES = [
  '/dashboard',
  '/dashboard/inventory',
  '/master/customers',
  '/master/products',
  '/master/warehouses',
  '/master/locations',
  '/operations/receiving',
  '/operations/receiving/new',
  '/operations/receiving/:id',
  '/operations/putaway',
  '/operations/putaway/new',
  '/operations/putaway/:id',
  '/operations/transfer',
  '/operations/transfer/new',
  '/operations/transfer/:id',
  '/operations/adjustment',
  '/operations/adjustment/new',
  '/operations/adjustment/:id',
  '/operations/withdrawal-requests',
  '/operations/withdrawal-requests/new',
  '/operations/withdrawal-requests/:id',
  '/operations/allocations',
  '/operations/allocations/new',
  '/operations/allocations/:id',
  '/operations/picking',
  '/operations/picking/new',
  '/operations/picking/:id',
  '/operations/dispatch',
  '/operations/dispatch/new',
  '/operations/dispatch/:id',
  '/handheld',
  '/stock-count',
  '/stock-count/new',
  '/stock-count/:id',
  '/reports',
  '/reports/movement-ledger',
  '/reports/customer-storage-balance',
  '/reports/storage-aging',
  '/reports/warehouse-operation-performance',
  '/reports/monthly-storage-billing-summary',
  '/reports/accounting-charge-staging-preview',
  '/reports/accounting-charge-handoff-review',
  '/settings',
  '/customers',
  '/products',
  '/locations',
  '/receiving',
  '/picking',
  '/transfer',
  '/adjustment',
  '/inventory',
  '/movement-ledger',
  '/audit',
];

// Helper arrays for validation
const VALID_AREAS = [
  'master_data', 'receiving', 'putaway', 'transfer', 'adjustment', 'stock_count',
  'withdrawal', 'allocation', 'picking', 'dispatch', 'reports',
  'accounting_review', 'admin', 'unknown',
];
const VALID_ROLES = ['admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'];
const VALID_ACCESS = ['read', 'write', 'review', 'admin'];

test('ROUTE_PERMISSION_CATALOG is defined and non‑empty', () => {
  expect(Array.isArray(ROUTE_PERMISSION_CATALOG)).toBe(true);
  expect(ROUTE_PERMISSION_CATALOG.length).toBeGreaterThan(0);
});

test('All catalog entries have required fields with valid values', () => {
  for (const entry of ROUTE_PERMISSION_CATALOG) {
    // route_path and route_name are strings
    expect(typeof entry.route_path).toBe('string');
    expect(entry.route_path.length).toBeGreaterThan(0);
    expect(typeof entry.route_name).toBe('string');
    // permission area
    expect(VALID_AREAS).toContain(entry.permission_area);
    // minimum_role
    expect(VALID_ROLES).toContain(entry.minimum_role);
    // access_level
    expect(VALID_ACCESS).toContain(entry.access_level);
    // unknown routes must have notes
    if (entry.permission_area === 'unknown') {
      expect(entry.notes && entry.notes.length).toBeGreaterThan(0);
    }
  }
});

test('No duplicate route_path entries in catalog', () => {
  const duplicates = findDuplicatePermissionEntries(ROUTE_PERMISSION_CATALOG);
  expect(duplicates.length).toBe(0);
});

test('All application routes are cataloged or intentionally unknown', () => {
  const uncataloged = findUncatalogedRoutes(APP_ROUTES, ROUTE_PERMISSION_CATALOG);
  // The catalog explicitly includes placeholder routes as unknown, so there should be none left.
  expect(uncataloged.length).toBe(0);
});

test('validateRoutePermissionCatalog returns no errors for current catalog', () => {
  const errors = validateRoutePermissionCatalog(APP_ROUTES);
  expect(errors.length).toBe(0);
});

test('Audit service aggregates findings correctly', () => {
  const audit = auditRoutePermissionCatalog(APP_ROUTES, ROUTE_PERMISSION_CATALOG);
  expect(audit.uncatalogedRoutes.length).toBe(0);
  expect(audit.duplicateEntries.length).toBe(0);
  expect(audit.unknownAreaEntries.length).toBeGreaterThan(0); // placeholder routes exist
  expect(audit.missingRoleEntries.length).toBe(0);
  const summary = summarizeRoutePermissionAudit(audit);
  expect(typeof summary).toBe('string');
  expect(summary).toContain('Uncataloged routes');
});

// Ensure no forbidden imports are present – this test simply checks the source files for disallowed strings.
const fs = require('fs');
const path = require('path');
function fileContainsForbiddenTerms(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const forbidden = [
    'fetch(', 'axios', 'XMLHttpRequest', 'fs.', 'writeFile', 'supabase',
    'postAccounting', 'generateInvoice', 'lockBillingPeriod', 'syncInventory',
    'stockImport', 'stockExport', 'exportStockMovement', 'sendToBplus', 'sendToERP',
  ];
  return forbidden.some((term) => content.includes(term));
}

test('Security files do not contain forbidden terms', () => {
  const securityFiles = [
    path.resolve(__dirname, '../../src/security/routePermissionCatalog.js'),
    path.resolve(__dirname, '../../src/security/routePermissionAuditService.js'),
  ];
  for (const file of securityFiles) {
    expect(fileContainsForbiddenTerms(file)).toBe(false);
  }
});
