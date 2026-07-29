import { resolveCustomRoleBaseRole } from './customRoleBaseRoles.js';

const CUSTOMER_ROLES = Object.freeze(['customer_admin', 'customer_user']);

export const ROLE_HIERARCHY = {
  viewer: 1,
  warehouse_staff: 2,
  warehouse_admin: 3,
  accounting: 3,
  warehouse_manager: 4,
  admin: 5,
};

function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

/**
 * Check if a user role meets or exceeds a required role.
 */
export function hasRoleAccess(userRole, requiredRole) {
  // A custom role (created via RolePermissionsAdminPage, stored in
  // tgd_role_definitions) is treated as its base_role here — otherwise an
  // unrecognized role_code would fall through to ROLE_HIERARCHY's `?? 0`
  // and be denied every route/menu, even though it's a legally assignable
  // role at the database level.
  const user = resolveCustomRoleBaseRole(normalizeRole(userRole));
  const required = normalizeRole(requiredRole);

  if (user === 'admin') {
    return true;
  }

  if (CUSTOMER_ROLES.includes(required)) {
    if (required === 'customer_user') {
      return user === 'customer_user' || user === 'customer_admin';
    }
    if (required === 'customer_admin') {
      return user === 'customer_admin';
    }
    return false;
  }

  if (CUSTOMER_ROLES.includes(user)) {
    return false;
  }

  const userLevel = ROLE_HIERARCHY[user] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[required] ?? 0;
  return userLevel >= requiredLevel;
}

export function roleThresholdLevel(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'customer_user') return 0;
  if (normalized === 'customer_admin') return 1;
  return ROLE_HIERARCHY[normalized] ?? 99;
}
