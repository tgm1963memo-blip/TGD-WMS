export const CUSTOMER_PORTAL_DEMO_ROLES = Object.freeze([
  'admin',
  'accounting',
  'warehouse_manager',
  'warehouse_staff',
  'viewer',
  'customer',
  'customer_admin',
  'customer_user',
]);

export function isCustomerPortalNavigationVisible(role) {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return CUSTOMER_PORTAL_DEMO_ROLES.includes(normalized);
}

export function isCustomerOpsDemoNavigationVisible(role) {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return ['admin', 'accounting', 'viewer'].includes(normalized);
}
