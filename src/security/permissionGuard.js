// src/security/permissionGuard.js

/**
 * Permission Guard utilities – frontend only.
 * Provides role hierarchy and access decision logic.
 * No side effects, no network, no storage.
 */

import { getRoutePermission } from './routePermissionCatalog.js';
import { canCustomerRequestProxyAccessRoute } from './customerRequestProxyPermissions.js';
import { canWarehouseRoleAccessRoute } from './warehouseRolePermissions.js';
import { hasRoleAccess } from './roleAccess.js';
import { getRoleFunctionOverride } from './roleFunctionPermissions.js';
import { getFunctionKeysForPath } from './navigationPermissionCatalog.js';

const CUSTOMER_ROLES = Object.freeze(['customer_admin', 'customer_user']);

const AUTHENTICATED_ONLY_ROUTES = Object.freeze([
  '/',
  '/settings/profile',
]);

export { hasRoleAccess, ROLE_HIERARCHY } from './roleAccess.js';

function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

function getFunctionAccessDecision(userRole, routePath) {
  const role = normalizeRole(userRole);
  const keys = getFunctionKeysForPath(routePath);
  for (const functionKey of keys) {
    const override = getRoleFunctionOverride(role, functionKey);
    if (override !== undefined) {
      return { allowed: override, functionKey };
    }
  }
  return null;
}

/**
 * Determine if a user can access a given route path.
 * Looks up the route in ROUTE_PERMISSION_CATALOG (imported lazily).
 * @param {string} userRole
 * @param {string} routePath
 * @returns {{allowed:boolean, required_role:string, permission_area:string, access_level:string, reason:string}}
 */
// allowedMenuKeys: null (default) = no extra restriction, matches every
// caller today. A non-null array additionally requires the matched
// catalog entry's menu_key (when set — only customer_portal entries that
// have a corresponding sidebar item carry one) to be in that list — so a
// restricted customer_user can't reach a hidden menu's route by typing the
// URL directly. See tgd_customer_custom_roles / UserRoleProvider.jsx.
export function canAccessRoute(userRole, routePath, allowedMenuKeys = null) {
  const path = String(routePath ?? '');
  if (AUTHENTICATED_ONLY_ROUTES.includes(path)) {
    return {
      allowed: true,
      required_role: null,
      permission_area: 'admin',
      access_level: 'read',
      reason: 'Authenticated profile settings',
    };
  }

  const functionDecision = getFunctionAccessDecision(userRole, path);
  if (functionDecision) {
    const entry = getRoutePermission(routePath);
    return {
      allowed: functionDecision.allowed,
      required_role: entry?.minimum_role ?? normalizeRole(userRole),
      permission_area: entry?.permission_area ?? null,
      access_level: entry?.access_level ?? 'read',
      reason: functionDecision.allowed
        ? `Access granted by function override (${functionDecision.functionKey})`
        : `Function permission denied (${functionDecision.functionKey})`,
    };
  }

  const warehouseDecision = canWarehouseRoleAccessRoute(userRole, routePath);
  if (warehouseDecision === true) {
    const warehouseEntry = getRoutePermission(routePath);
    return {
      allowed: true,
      required_role: normalizeRole(userRole),
      permission_area: warehouseEntry?.permission_area ?? 'warehouse',
      access_level: warehouseEntry?.access_level ?? 'read',
      reason: 'Warehouse role route allowlist',
    };
  }

  const proxyDecision = canCustomerRequestProxyAccessRoute(userRole, routePath);
  if (proxyDecision === true) {
    return {
      allowed: true,
      required_role: normalizeRole(userRole),
      permission_area: 'customer_portal',
      access_level: 'write',
      reason: 'Customer request proxy role route allowlist',
    };
  }

  if (warehouseDecision === false) {
    return {
      allowed: false,
      required_role: normalizeRole(userRole),
      permission_area: 'warehouse',
      access_level: 'read',
      reason: 'Route not allowed for warehouse role scope',
    };
  }

  const entry = getRoutePermission(routePath);
  if (!entry) {
    return {
      allowed: false,
      required_role: null,
      permission_area: null,
      access_level: null,
      reason: `Route not found in permission catalog: ${routePath}`,
    };
  }
  const { minimum_role, permission_area, access_level, menu_key } = entry;
  let allowed = hasRoleAccess(userRole, minimum_role);
  let reason = allowed ? 'Access granted' : `Required role ${minimum_role}`;
  if (allowed && allowedMenuKeys != null && menu_key && !allowedMenuKeys.includes(menu_key)) {
    allowed = false;
    reason = `Menu "${menu_key}" not included in the user's custom role`;
  }
  return { allowed, required_role: minimum_role, permission_area, access_level, reason };
}

/**
 * Build the full access decision object.
 */
export function getRouteAccessDecision(userRole, routePath, allowedMenuKeys = null) {
  const decision = canAccessRoute(userRole, routePath, allowedMenuKeys);
  return {
    allowed: decision.allowed,
    route_path: routePath,
    user_role: userRole,
    required_role: decision.required_role,
    permission_area: decision.permission_area,
    access_level: decision.access_level,
    reason: decision.reason,
  };
}

/**
 * Create a minimal guard context for the UI.
 * Currently just passes through the user role.
 */
export function createPermissionGuardContext(user) {
  return { userRole: user?.role ?? 'viewer' };
}
