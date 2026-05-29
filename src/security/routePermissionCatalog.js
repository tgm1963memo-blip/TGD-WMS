// src/security/routePermissionCatalog.js

/**
 * Route Permission Catalog for TGD WMS.
 * Each entry describes the permission area, minimum role, access level, and optional notes.
 */
export const ROUTE_PERMISSION_CATALOG = [
  // Master Data
  { route_path: '/master/customers', route_name: 'CustomersPage', permission_area: 'master_data', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/master/products', route_name: 'ProductsPage', permission_area: 'master_data', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/master/warehouses', route_name: 'WarehousesPage', permission_area: 'master_data', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/master/locations', route_name: 'LocationsPage', permission_area: 'master_data', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  // Receiving
  { route_path: '/operations/receiving', route_name: 'ReceivingPage', permission_area: 'receiving', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/receiving/new', route_name: 'ReceivingCreatePage', permission_area: 'receiving', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/receiving/:id', route_name: 'ReceivingDetailPage', permission_area: 'receiving', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Putaway
  { route_path: '/operations/putaway', route_name: 'PutawayPage', permission_area: 'putaway', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/putaway/new', route_name: 'PutawayCreatePage', permission_area: 'putaway', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/putaway/:id', route_name: 'PutawayDetailPage', permission_area: 'putaway', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Transfer
  { route_path: '/operations/transfer', route_name: 'TransferPage', permission_area: 'transfer', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/transfer/new', route_name: 'TransferCreatePage', permission_area: 'transfer', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/transfer/:id', route_name: 'TransferDetailPage', permission_area: 'transfer', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Adjustment
  { route_path: '/operations/adjustment', route_name: 'AdjustmentPage', permission_area: 'adjustment', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/operations/adjustment/new', route_name: 'AdjustmentCreatePage', permission_area: 'adjustment', minimum_role: 'warehouse_manager', access_level: 'write', notes: '' },
  { route_path: '/operations/adjustment/:id', route_name: 'AdjustmentDetailPage', permission_area: 'adjustment', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  // Withdrawal
  { route_path: '/operations/withdrawal-requests', route_name: 'WithdrawalRequestsPage', permission_area: 'withdrawal', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/withdrawal-requests/new', route_name: 'WithdrawalRequestCreatePage', permission_area: 'withdrawal', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/withdrawal-requests/:id', route_name: 'WithdrawalRequestDetailPage', permission_area: 'withdrawal', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Allocation
  { route_path: '/operations/allocations', route_name: 'AllocationsPage', permission_area: 'allocation', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/allocations/new', route_name: 'AllocationCreatePage', permission_area: 'allocation', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/allocations/:id', route_name: 'AllocationDetailPage', permission_area: 'allocation', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Picking
  { route_path: '/operations/picking', route_name: 'PickingPage', permission_area: 'picking', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/picking/new', route_name: 'PickingCreatePage', permission_area: 'picking', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/picking/:id', route_name: 'PickingDetailPage', permission_area: 'picking', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Dispatch
  { route_path: '/operations/dispatch', route_name: 'DispatchPage', permission_area: 'dispatch', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/operations/dispatch/new', route_name: 'DispatchCreatePage', permission_area: 'dispatch', minimum_role: 'warehouse_staff', access_level: 'write', notes: '' },
  { route_path: '/operations/dispatch/:id', route_name: 'DispatchDetailPage', permission_area: 'dispatch', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  // Stock Count
  { route_path: '/stock-count', route_name: 'StockCountPage', permission_area: 'stock_count', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/stock-count/new', route_name: 'StockCountCreatePage', permission_area: 'stock_count', minimum_role: 'warehouse_manager', access_level: 'write', notes: '' },
  { route_path: '/stock-count/:id', route_name: 'StockCountDetailPage', permission_area: 'stock_count', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  // Reports (viewer)
  { route_path: '/reports', route_name: 'ReportsPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/movement-ledger', route_name: 'MovementLedgerReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/customer-storage-balance', route_name: 'CustomerStorageBalanceReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/storage-aging', route_name: 'StorageAgingReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/warehouse-operation-performance', route_name: 'WarehouseOperationPerformanceReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/monthly-storage-billing-summary', route_name: 'MonthlyStorageBillingSummaryPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  // Accounting Review (accounting)
  { route_path: '/reports/accounting-charge-staging-preview', route_name: 'AccountingChargeStagingPreviewPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  { route_path: '/reports/accounting-charge-handoff-review', route_name: 'AccountingChargeHandoffReviewPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  // Admin
  { route_path: '/settings', route_name: 'SettingsPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  // Legacy/Placeholder routes – unknown area
  { route_path: '/inventory', route_name: 'LegacyPlaceholderPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/movement-ledger', route_name: 'LegacyPlaceholderPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/audit', route_name: 'LegacyPlaceholderPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/customers', route_name: 'CustomersPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/products', route_name: 'ProductsPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/locations', route_name: 'LocationsPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/receiving', route_name: 'ReceivingPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/picking', route_name: 'PickingPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/transfer', route_name: 'TransferPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/adjustment', route_name: 'AdjustmentPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/dashboard', route_name: 'DashboardPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/dashboard/inventory', route_name: 'InventoryDashboardPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
  { route_path: '/handheld', route_name: 'HandheldPage', permission_area: 'unknown', minimum_role: 'admin', access_level: 'read', notes: 'Placeholder route pending permission decision' },
];

/** Retrieve permission entry for a specific route path */
export function getRoutePermission(routePath) {
  return ROUTE_PERMISSION_CATALOG.find((entry) => entry.route_path === routePath) || null;
}
/** List all permission entries (shallow copy) */
export function listRoutePermissions() {
  return [...ROUTE_PERMISSION_CATALOG];
}
/** Group routes by permission area */
export function groupRoutesByPermissionArea() {
  return ROUTE_PERMISSION_CATALOG.reduce((acc, entry) => {
    const area = entry.permission_area;
    if (!acc[area]) acc[area] = [];
    acc[area].push(entry);
    return acc;
  }, {});
}
/** Validate catalog consistency */
export function validateRoutePermissionCatalog(routes) {
  const errors = [];
  const knownAreas = [
    'master_data', 'receiving', 'putaway', 'transfer', 'adjustment', 'stock_count',
    'withdrawal', 'allocation', 'picking', 'dispatch', 'reports',
    'accounting_review', 'admin', 'unknown',
  ];
  const seen = new Set();
  for (const entry of ROUTE_PERMISSION_CATALOG) {
    // Unique route_path
    if (seen.has(entry.route_path)) {
      errors.push(`Duplicate route_path: ${entry.route_path}`);
    } else {
      seen.add(entry.route_path);
    }
    // Permission area must be known
    if (!knownAreas.includes(entry.permission_area)) {
      errors.push(`Unknown permission_area ${entry.permission_area} for ${entry.route_path}`);
    }
    // Minimum role must be present
    if (!entry.minimum_role) {
      errors.push(`Missing minimum_role for ${entry.route_path}`);
    }
    // Access level must be present
    if (!entry.access_level) {
      errors.push(`Missing access_level for ${entry.route_path}`);
    }
    // Allow unknown routes only when all required fields are set and notes present
    if (entry.permission_area === 'unknown') {
      if (entry.minimum_role !== 'admin' || entry.access_level !== 'read' || !entry.notes) {
        errors.push(`Invalid unknown route definition for ${entry.route_path}`);
      }
    }
  }
  // Ensure all provided routes exist in catalog (optional, external callers can check)
  return errors;
}
