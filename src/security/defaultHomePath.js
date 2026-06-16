import { normalizeUserRole } from './currentUserRole.js';

const CUSTOMER_ROLES = Object.freeze(['customer_admin', 'customer_user']);

const DEFAULT_HOME_BY_ROLE = Object.freeze({
  admin: '/dashboard',
  warehouse_manager: '/operations/receiving',
  warehouse_staff: '/operations/receiving',
  accounting: '/reports',
  viewer: '/reports',
  customer_admin: '/customer',
  customer_user: '/customer',
});

export function resolveDefaultHomePath(role) {
  const normalized = normalizeUserRole(role);

  if (CUSTOMER_ROLES.includes(normalized)) {
    return '/customer';
  }

  return DEFAULT_HOME_BY_ROLE[normalized] ?? '/reports';
}
