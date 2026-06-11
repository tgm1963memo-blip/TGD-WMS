export const CUSTOMER_PORTAL_DEMO_ROLES = Object.freeze([
  'admin',
  'accounting',
  'warehouse_manager',
  'warehouse_staff',
  'viewer',
  'customer',
]);

export function isCustomerPortalNavigationVisible(role) {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return CUSTOMER_PORTAL_DEMO_ROLES.includes(normalized);
}
