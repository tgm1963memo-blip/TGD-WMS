const NAV_ITEM_ROUTE_OVERRIDES = Object.freeze({
  master_data: '/master/customers',
  users_and_roles: '/admin/auth-readiness',
  user_management: '/admin/users',
  customer_product_catalog_admin: '/admin/customer-products',
  customer_storage_rate_rules_admin: '/admin/customer-storage-rates',
});

export function resolveNavigationItemPath(item) {
  if (!item) return null;
  if (item.path) return item.path;
  return NAV_ITEM_ROUTE_OVERRIDES[item.key] ?? null;
}
