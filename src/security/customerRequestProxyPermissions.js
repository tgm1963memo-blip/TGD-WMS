import { isCustomerRequestProxyRole } from '../services/customerPortalServiceUtils.js';
import { normalizeUserRole } from './currentUserRole.js';

const CUSTOMER_REQUEST_PROXY_ROUTE_PREFIXES = Object.freeze([
  '/customer/deposit-request',
  '/customer/withdrawal-request',
]);

function matchesRoutePrefix(routePath, prefixes) {
  return prefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`));
}

export function canCustomerRequestProxyAccessRoute(role, routePath) {
  const normalized = normalizeUserRole(role);
  if (!isCustomerRequestProxyRole(normalized)) {
    return null;
  }

  const path = String(routePath ?? '');
  if (matchesRoutePrefix(path, CUSTOMER_REQUEST_PROXY_ROUTE_PREFIXES)) {
    return true;
  }
  return null;
}

export const CUSTOMER_PORTAL_PROXY_NAV_ITEM_KEYS = Object.freeze([
  'customer_deposit_request',
  'customer_withdrawal_request',
]);
