import { normalizeUserRole } from './currentUserRole.js';
import { navigationGroups } from '../app/navigation.js';

const CUSTOMER_ROLES = Object.freeze(['customer_admin', 'customer_user']);

const DEFAULT_HOME_BY_ROLE = Object.freeze({
  admin: '/dashboard',
  warehouse_manager: '/operations/receiving',
  warehouse_admin: '/operations/receiving',
  warehouse_staff: '/handheld',
  accounting: '/dashboard',
  viewer: '/reports',
  customer_admin: '/customer',
  customer_user: '/customer',
});

const CUSTOMER_PORTAL_ITEMS = navigationGroups.find((g) => g.key === 'customer_portal')?.items ?? [];

// A restricted customer_user (tgd_customer_custom_roles — see
// CustomerTeamRolesPage) may not have 'customer_portal_home' in their
// allowed_menu_keys, which is every customer role's fixed default below —
// landing them there anyway means a permission-denied wall right after
// login instead of a usable page. Walk the sidebar's own item order and
// land on the first one they're actually allowed to see.
function resolveCustomerHomePath(allowedMenuKeys) {
  if (allowedMenuKeys == null) return '/customer';
  const firstAllowed = CUSTOMER_PORTAL_ITEMS.find((item) => allowedMenuKeys.includes(item.key));
  return firstAllowed?.path ?? '/settings/profile';
}

export function resolveDefaultHomePath(role, allowedMenuKeys = null) {
  const normalized = normalizeUserRole(role);

  if (CUSTOMER_ROLES.includes(normalized)) {
    return resolveCustomerHomePath(allowedMenuKeys);
  }

  return DEFAULT_HOME_BY_ROLE[normalized] ?? '/reports';
}
