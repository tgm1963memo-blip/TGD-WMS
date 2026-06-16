export const USER_MANAGEMENT_ADMIN_ROLES = Object.freeze(['admin']);

export const CUSTOMER_CATALOG_WRITE_ROLES = Object.freeze(['admin', 'customer_admin', 'customer_user']);

export function canManageUsers(role) {
  return USER_MANAGEMENT_ADMIN_ROLES.includes(role);
}

export function canWriteCustomerCatalog(role) {
  return CUSTOMER_CATALOG_WRITE_ROLES.includes(role);
}
