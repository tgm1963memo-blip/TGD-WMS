// src/security/permissionGuard.js

/**
 * Permission Guard utilities – frontend only.
 * Provides role hierarchy and access decision logic.
 * No side effects, no network, no storage.
 */

import { getRoutePermission } from './routePermissionCatalog.js';

export const ROLE_HIERARCHY = {
  viewer: 1,
  warehouse_staff: 2,
  accounting: 3,
  warehouse_manager: 4,
  admin: 5,
};

/**
 * Check if a user role meets or exceeds a required role.
 * @param {string} userRole - role of the current user.
 * @param {string} requiredRole - minimum role required.
 * @returns {boolean}
 */
export function hasRoleAccess(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Determine if a user can access a given route path.
 * Looks up the route in ROUTE_PERMISSION_CATALOG (imported lazily).
 * @param {string} userRole
 * @param {string} routePath
 * @returns {{allowed:boolean, required_role:string, permission_area:string, access_level:string, reason:string}}
 */
export function canAccessRoute(userRole, routePath) {
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
  const { minimum_role, permission_area, access_level } = entry;
  const allowed = hasRoleAccess(userRole, minimum_role);
  const reason = allowed ? 'Access granted' : `Required role ${minimum_role}`;
  return { allowed, required_role: minimum_role, permission_area, access_level, reason };
}

/**
 * Build the full access decision object.
 */
export function getRouteAccessDecision(userRole, routePath) {
  const decision = canAccessRoute(userRole, routePath);
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
