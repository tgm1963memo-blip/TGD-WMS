import { normalizeUserRole } from './currentUserRole.js';
import { getRoleFunctionOverride } from './roleFunctionPermissions.js';
import { hasRoleAccess } from './roleAccess.js';
import { getRoutePermission } from './routePermissionCatalog.js';
import { resolveNavigationItemPath } from './navigationPaths.js';
import {
  isLegacyNavigationGroupVisibleForRole,
  isLegacyNavigationItemVisibleForRole,
} from './legacyNavigationVisibility.js';

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

export { resolveNavigationItemPath } from './navigationPaths.js';

export function isCustomerRole(role) {
  return CUSTOMER_ROLES.includes(normalizeUserRole(role));
}

export function isInternalRole(role) {
  return INTERNAL_ROLES.includes(normalizeUserRole(role));
}

export function isNavigationPathVisibleForRole(role, path) {
  if (!path) return true;
  const entry = getRoutePermission(path);
  if (!entry) return false;
  return hasRoleAccess(normalizeUserRole(role), entry.minimum_role);
}

export function isNavigationGroupVisibleForRole(groupKey, role) {
  return isLegacyNavigationGroupVisibleForRole(groupKey, role);
}

export { isLegacyNavigationItemVisibleForRole } from './legacyNavigationVisibility.js';

export function isNavigationItemVisibleForRole(item, groupKey, role) {
  if (!item) return false;

  const normalized = normalizeUserRole(role);
  const functionOverride = getRoleFunctionOverride(normalized, item.key);
  if (functionOverride !== undefined) {
    return functionOverride;
  }

  return isLegacyNavigationItemVisibleForRole(item, groupKey, role);
}

export function filterNavigationGroupsForRole(groups, role) {
  return groups
    .map((group) => {
      const items = group.items.filter((item) => isNavigationItemVisibleForRole(item, group.key, role));
      if (!items.length) {
        return null;
      }
      return { ...group, items };
    })
    .filter(Boolean);
}
