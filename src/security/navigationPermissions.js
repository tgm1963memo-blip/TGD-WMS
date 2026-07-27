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

// allowedMenuKeys: null (the default for every role except a restricted
// customer_user) means unrestricted — behaves exactly as before this
// param existed. A non-null array additionally requires item.key to be
// in that list, on top of whatever the role-based check already allows —
// so a restricted customer_user's role-based access is scoped down, never
// widened, by their custom role's menu checklist. See
// tgd_customer_custom_roles / UserRoleProvider.jsx.
export function filterNavigationGroupsForRole(groups, role, allowedMenuKeys = null) {
  return groups
    .map((group) => {
      const items = group.items.filter((item) => {
        if (!isNavigationItemVisibleForRole(item, group.key, role)) return false;
        if (allowedMenuKeys != null && !allowedMenuKeys.includes(item.key)) return false;
        return true;
      });
      if (!items.length) {
        return null;
      }
      return { ...group, items };
    })
    .filter(Boolean);
}
