// src/security/routePermissionCatalog.js

import { matchPath } from 'react-router-dom';

/**
 * Route Permission Catalog — aligned with navigation menu and active UI routes only.
 */
export const ROUTE_PERMISSION_CATALOG = [
  { route_path: '/dashboard', route_name: 'DashboardPage', permission_area: 'reports', minimum_role: 'admin', access_level: 'read', notes: '' },
  { route_path: '/dashboard/inventory', route_name: 'InventoryDashboardPage', permission_area: 'reports', minimum_role: 'admin', access_level: 'read', notes: '' },
  { route_path: '/master/customers', route_name: 'CustomersPage', permission_area: 'master_data', minimum_role: 'warehouse_manager', access_level: 'read', notes: '' },
  { route_path: '/operations/receiving', route_name: 'ReceivingPage', permission_area: 'receiving', minimum_role: 'warehouse_admin', access_level: 'read', notes: 'Customer deposit driven inbound only' },
  { route_path: '/operations/receiving/:id', route_name: 'ReceivingDetailPage', permission_area: 'receiving', minimum_role: 'warehouse_admin', access_level: 'read', notes: '' },
  { route_path: '/operations/withdrawal-requests', route_name: 'WithdrawalRequestsPage', permission_area: 'withdrawal', minimum_role: 'warehouse_admin', access_level: 'read', notes: '' },
  { route_path: '/operations/withdrawal-requests/new', route_name: 'WithdrawalRequestCreatePage', permission_area: 'withdrawal', minimum_role: 'warehouse_admin', access_level: 'write', notes: '' },
  { route_path: '/operations/withdrawal-requests/:id', route_name: 'WithdrawalRequestDetailPage', permission_area: 'withdrawal', minimum_role: 'warehouse_admin', access_level: 'read', notes: '' },
  { route_path: '/inventory', route_name: 'InventoryBalancePage', permission_area: 'reports', minimum_role: 'warehouse_admin', access_level: 'read', notes: '' },
  { route_path: '/handheld', route_name: 'HandheldPage', permission_area: 'receiving', minimum_role: 'warehouse_staff', access_level: 'read', notes: '' },
  { route_path: '/reports', route_name: 'ReportsPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/movement-ledger', route_name: 'MovementLedgerReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/customer-storage-balance', route_name: 'CustomerStorageBalanceReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/storage-aging', route_name: 'StorageAgingReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/warehouse-operation-performance', route_name: 'WarehouseOperationPerformanceReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/monthly-storage-billing-summary', route_name: 'MonthlyStorageBillingSummaryPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/billing-movement-weight', route_name: 'BillingMovementWeightReportPage', permission_area: 'reports', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/reports/accounting-charge-staging-preview', route_name: 'AccountingChargeStagingPreviewPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  { route_path: '/reports/accounting-charge-handoff-review', route_name: 'AccountingChargeHandoffReviewPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  { route_path: '/billing/invoice-drafts', route_name: 'InvoiceDraftListPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  { route_path: '/billing/invoice-drafts/:draftId', route_name: 'InvoiceDraftDetailPage', permission_area: 'accounting_review', minimum_role: 'accounting', access_level: 'read', notes: '' },
  { route_path: '/admin/warehouse-locations', route_name: 'WarehouseLocationSetupPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/admin/users', route_name: 'UserManagementPage', permission_area: 'user_management', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/admin/customer-products', route_name: 'CustomerProductCatalogAdminPage', permission_area: 'customer_catalog', minimum_role: 'admin', access_level: 'write', notes: '' },
  { route_path: '/admin/customer-request-policy', route_name: 'CustomerRequestPolicyAdminPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/admin/product-service-rates', route_name: 'CustomerProductServiceRatesPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/admin/role-permissions', route_name: 'RolePermissionsAdminPage', permission_area: 'user_management', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/admin/auth-readiness', route_name: 'AuthReadinessPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/settings/profile', route_name: 'ProfileSettingsPage', permission_area: 'admin', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/settings/change-password', route_name: 'ChangePasswordPage', permission_area: 'admin', minimum_role: 'viewer', access_level: 'read', notes: '' },
  { route_path: '/settings/email', route_name: 'EmailSettingsPage', permission_area: 'admin', minimum_role: 'admin', access_level: 'admin', notes: '' },
  { route_path: '/customer', route_name: 'CustomerPortalDashboardPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/deposit-request', route_name: 'CustomerDepositRequestPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/deposit-request/new', route_name: 'CustomerDepositRequestCreatePage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'write', notes: '' },
  { route_path: '/customer/deposit-request/:requestId', route_name: 'CustomerDepositRequestDetailPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/stock-balance', route_name: 'CustomerStockBalancePage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/withdrawal-request', route_name: 'CustomerWithdrawalRequestPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/withdrawal-request/new', route_name: 'CustomerWithdrawalRequestCreatePage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'write', notes: '' },
  { route_path: '/customer/withdrawal-request/:requestId', route_name: 'CustomerWithdrawalRequestDetailPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/requests', route_name: 'CustomerRequestHistoryPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'read', notes: '' },
  { route_path: '/customer/facility-usage', route_name: 'CustomerFacilityUsageRequestPage', permission_area: 'customer_portal', minimum_role: 'customer_user', access_level: 'write', notes: '' },
  { route_path: '/customer/admin/deposit-review', route_name: 'CustomerAdminDepositReviewPage', permission_area: 'customer_portal', minimum_role: 'warehouse_admin', access_level: 'read', notes: 'Linked from receiving workflow' },
  { route_path: '/customer/admin/deposit-review/:requestId', route_name: 'CustomerAdminDepositReviewPage', permission_area: 'customer_portal', minimum_role: 'warehouse_admin', access_level: 'read', notes: '' },
  { route_path: '/customer/admin/withdrawal-review', route_name: 'CustomerAdminWithdrawalReviewPage', permission_area: 'customer_portal', minimum_role: 'warehouse_admin', access_level: 'read', notes: 'Linked from withdrawal notifications' },
];

const CATALOG_SORTED_BY_SPECIFICITY = [...ROUTE_PERMISSION_CATALOG].sort(
  (left, right) => right.route_path.length - left.route_path.length,
);

export function getRoutePermission(routePath) {
  const path = String(routePath ?? '');
  const exact = ROUTE_PERMISSION_CATALOG.find((entry) => entry.route_path === path);
  if (exact) {
    return exact;
  }

  for (const entry of CATALOG_SORTED_BY_SPECIFICITY) {
    if (!entry.route_path.includes(':')) {
      continue;
    }
    if (matchPath({ path: entry.route_path, end: true }, path)) {
      return entry;
    }
  }

  return null;
}

export function listRoutePermissions() {
  return [...ROUTE_PERMISSION_CATALOG];
}

export function groupRoutesByPermissionArea() {
  return ROUTE_PERMISSION_CATALOG.reduce((acc, entry) => {
    const area = entry.permission_area;
    if (!acc[area]) acc[area] = [];
    acc[area].push(entry);
    return acc;
  }, {});
}

export function validateRoutePermissionCatalog() {
  const errors = [];
  const knownAreas = [
    'master_data', 'receiving', 'withdrawal', 'reports',
    'accounting_review', 'admin', 'user_management', 'customer_catalog', 'customer_portal',
  ];
  const seen = new Set();
  for (const entry of ROUTE_PERMISSION_CATALOG) {
    if (seen.has(entry.route_path)) {
      errors.push(`Duplicate route_path: ${entry.route_path}`);
    } else {
      seen.add(entry.route_path);
    }
    if (!knownAreas.includes(entry.permission_area)) {
      errors.push(`Unknown permission_area ${entry.permission_area} for ${entry.route_path}`);
    }
    if (!entry.minimum_role) {
      errors.push(`Missing minimum_role for ${entry.route_path}`);
    }
    if (!entry.access_level) {
      errors.push(`Missing access_level for ${entry.route_path}`);
    }
  }
  return errors;
}
