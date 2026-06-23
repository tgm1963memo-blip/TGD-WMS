import { normalizeUserRole } from './currentUserRole.js';
import { isBillingNavigationItemVisible } from './billingInvoiceDraftPermissions.js';
import { isCustomerOpsDemoNavigationVisible } from './customerPortalPermissions.js';
import { CUSTOMER_PORTAL_PROXY_NAV_ITEM_KEYS } from './customerRequestProxyPermissions.js';
import { isCustomerRequestProxyRole } from '../services/customerPortalServiceUtils.js';
import { hasRoleAccess } from './roleAccess.js';
import { getRoutePermission } from './routePermissionCatalog.js';
import {
  isWarehouseNavGroupVisible,
  isWarehouseNavItemVisible,
} from './warehouseRolePermissions.js';
import { resolveNavigationItemPath } from './navigationPaths.js';

const CUSTOMER_ROLES = Object.freeze(['customer_admin', 'customer_user']);
const INTERNAL_ROLES = Object.freeze([
  'viewer',
  'warehouse_staff',
  'warehouse_admin',
  'warehouse_manager',
  'accounting',
  'admin',
]);

const CUSTOMER_PORTAL_GROUP = 'customer_portal';
const CUSTOMER_OPS_DEMO_GROUP = 'customer_ops_demo';

const WAREHOUSE_OPERATION_GROUPS = Object.freeze([
  'inbound_management',
  'outbound_management',
  'inventory_control',
  'barcode_handheld',
]);

const ACCOUNTING_HIDDEN_GROUPS = new Set(WAREHOUSE_OPERATION_GROUPS);

function isCustomerRole(role) {
  return CUSTOMER_ROLES.includes(normalizeUserRole(role));
}

function isInternalRole(role) {
  return INTERNAL_ROLES.includes(normalizeUserRole(role));
}

export function isLegacyNavigationGroupVisibleForRole(groupKey, role) {
  const normalized = normalizeUserRole(role);

  if (groupKey === CUSTOMER_OPS_DEMO_GROUP) {
    return isCustomerOpsDemoNavigationVisible(normalized);
  }

  if (isCustomerRole(normalized)) {
    return groupKey === CUSTOMER_PORTAL_GROUP;
  }

  if (groupKey === CUSTOMER_PORTAL_GROUP) {
    return normalized === 'admin' || isCustomerRequestProxyRole(normalized);
  }

  if (normalized === 'accounting' && ACCOUNTING_HIDDEN_GROUPS.has(groupKey)) {
    return false;
  }

  if (['warehouse_staff', 'warehouse_admin', 'warehouse_manager'].includes(normalized)) {
    return isWarehouseNavGroupVisible(normalized, groupKey);
  }

  return true;
}

export function isLegacyNavigationItemVisibleForRole(item, groupKey, role) {
  if (!item) return false;

  const normalized = normalizeUserRole(role);

  if (item.key === 'dashboard') {
    return normalized === 'admin';
  }

  if (!isLegacyNavigationGroupVisibleForRole(groupKey, role)) {
    return false;
  }

  if (
    groupKey === CUSTOMER_PORTAL_GROUP
    && isCustomerRequestProxyRole(normalized)
    && normalized !== 'admin'
    && !CUSTOMER_PORTAL_PROXY_NAV_ITEM_KEYS.includes(item.key)
  ) {
    return false;
  }

  if (!isBillingNavigationItemVisible(item.key, role)) {
    return false;
  }

  if (['warehouse_staff', 'warehouse_admin', 'warehouse_manager'].includes(normalized)) {
    const isProxyPortalItem = groupKey === CUSTOMER_PORTAL_GROUP
      && CUSTOMER_PORTAL_PROXY_NAV_ITEM_KEYS.includes(item.key);
    if (!isProxyPortalItem && !isWarehouseNavItemVisible(normalized, item.key)) {
      return false;
    }
  }

  if (item.disabled) {
    return isInternalRole(normalizeUserRole(role)) && normalizeUserRole(role) !== 'viewer';
  }

  const path = resolveNavigationItemPath(item);
  if (!path) {
    return false;
  }

  const entry = getRoutePermission(path);
  if (!entry) {
    return false;
  }

  return hasRoleAccess(normalized, entry.minimum_role);
}
