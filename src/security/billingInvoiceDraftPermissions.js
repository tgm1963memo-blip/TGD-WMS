import { normalizeUserRole } from './currentUserRole.js';

export const BILLING_INVOICE_DRAFT_READ_ROLES = Object.freeze([
  'admin',
  'accounting',
  'warehouse_manager',
]);

export const BILLING_INVOICE_DRAFT_WRITE_ROLES = Object.freeze([
  'admin',
  'accounting',
]);

export const BILLING_INVOICE_DRAFT_PERMISSION_MESSAGE =
  'You do not have permission to access billing invoice drafts.';

export function canReadBillingInvoiceDrafts(userRole) {
  return BILLING_INVOICE_DRAFT_READ_ROLES.includes(normalizeUserRole(userRole));
}

export function canWriteBillingInvoiceDrafts(userRole) {
  return BILLING_INVOICE_DRAFT_WRITE_ROLES.includes(normalizeUserRole(userRole));
}

export function canAccessBillingInvoiceDraftRoute(userRole) {
  return canReadBillingInvoiceDrafts(userRole);
}

export function isBillingNavigationItemVisible(itemKey, userRole) {
  if (itemKey === 'billing_invoice_drafts') {
    return canReadBillingInvoiceDrafts(userRole);
  }
  return true;
}
