import { normalizeUserRole } from './currentUserRole.js';

export const WAREHOUSE_ROLES = Object.freeze([
  'warehouse_staff',
  'warehouse_admin',
  'warehouse_manager',
]);

const WAREHOUSE_STAFF_NAV_GROUPS = Object.freeze(['barcode_handheld']);
const WAREHOUSE_STAFF_NAV_KEYS = Object.freeze(['scan_center']);

const WAREHOUSE_ADMIN_NAV_GROUPS = Object.freeze([
  'inbound_management',
  'outbound_management',
  'inventory_control',
]);
const WAREHOUSE_ADMIN_NAV_KEYS = Object.freeze([
  'receiving',
  'putaway',
  'withdrawal_request',
  'reservation',
  'picking_confirmation',
  'post_outbound',
  'dispatch_history',
  'stock_balance',
]);

const WAREHOUSE_ADMIN_ROUTE_PREFIXES = Object.freeze([
  '/operations/receiving',
  '/operations/putaway',
  '/operations/withdrawal-requests',
  '/operations/allocations',
  '/operations/picking',
  '/operations/outbound',
  '/operations/dispatch',
  '/stock-count',
  '/customer/admin/deposit-review',
  '/customer/admin/withdrawal-review',
]);

const WAREHOUSE_STAFF_ROUTE_PREFIXES = Object.freeze([
  '/handheld',
]);

const SHARED_ROUTE_PREFIXES = Object.freeze([
  '/settings/profile',
]);

function matchesRoutePrefix(routePath, prefixes) {
  return prefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`));
}

export function isWarehouseRole(role) {
  return WAREHOUSE_ROLES.includes(normalizeUserRole(role));
}

export function isWarehouseNavGroupVisible(role, groupKey) {
  const normalized = normalizeUserRole(role);

  if (normalized === 'warehouse_staff') {
    return WAREHOUSE_STAFF_NAV_GROUPS.includes(groupKey);
  }

  if (normalized === 'warehouse_admin') {
    return WAREHOUSE_ADMIN_NAV_GROUPS.includes(groupKey);
  }

  if (normalized === 'warehouse_manager') {
    return ['inbound_management', 'outbound_management', 'inventory_control', 'barcode_handheld'].includes(groupKey);
  }

  return true;
}

export function isWarehouseNavItemVisible(role, itemKey) {
  const normalized = normalizeUserRole(role);

  if (normalized === 'warehouse_staff') {
    return WAREHOUSE_STAFF_NAV_KEYS.includes(itemKey);
  }

  if (normalized === 'warehouse_admin') {
    return WAREHOUSE_ADMIN_NAV_KEYS.includes(itemKey);
  }

  return true;
}

export function canWarehouseRoleAccessRoute(role, routePath) {
  const normalized = normalizeUserRole(role);
  const path = String(routePath ?? '');

  if (matchesRoutePrefix(path, SHARED_ROUTE_PREFIXES)) {
    return true;
  }

  if (normalized === 'warehouse_staff') {
    return matchesRoutePrefix(path, WAREHOUSE_STAFF_ROUTE_PREFIXES);
  }

  if (normalized === 'warehouse_admin') {
    return matchesRoutePrefix(path, WAREHOUSE_ADMIN_ROUTE_PREFIXES);
  }

  return null;
}
