import { describe, expect, it } from 'vitest';
import { canAccessRoute } from '../../src/security/permissionGuard.js';
import { getRoutePermission } from '../../src/security/routePermissionCatalog.js';
import {
  BILLING_INVOICE_DRAFT_READ_ROLES,
  BILLING_INVOICE_DRAFT_WRITE_ROLES,
  canReadBillingInvoiceDrafts,
  canWriteBillingInvoiceDrafts,
  isBillingNavigationItemVisible,
} from '../../src/security/billingInvoiceDraftPermissions.js';

describe('Gate 3B-RLS billing invoice draft permissions', () => {
  it('defines controller-approved read and write role sets', () => {
    expect(BILLING_INVOICE_DRAFT_READ_ROLES).toEqual(['admin', 'accounting', 'warehouse_manager']);
    expect(BILLING_INVOICE_DRAFT_WRITE_ROLES).toEqual(['admin', 'accounting']);
  });

  it('allows read roles and blocks warehouse_staff/viewer', () => {
    expect(canReadBillingInvoiceDrafts('admin')).toBe(true);
    expect(canReadBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canReadBillingInvoiceDrafts('warehouse_manager')).toBe(true);
    expect(canReadBillingInvoiceDrafts('warehouse_staff')).toBe(false);
    expect(canReadBillingInvoiceDrafts('viewer')).toBe(false);
  });

  it('allows write only for admin and accounting', () => {
    expect(canWriteBillingInvoiceDrafts('admin')).toBe(true);
    expect(canWriteBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canWriteBillingInvoiceDrafts('warehouse_manager')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('warehouse_staff')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('viewer')).toBe(false);
  });

  it('hides invoice draft navigation for unauthorized roles', () => {
    expect(isBillingNavigationItemVisible('billing_invoice_drafts', 'admin')).toBe(true);
    expect(isBillingNavigationItemVisible('billing_invoice_drafts', 'warehouse_manager')).toBe(true);
    expect(isBillingNavigationItemVisible('billing_invoice_drafts', 'viewer')).toBe(false);
    expect(isBillingNavigationItemVisible('billing_movement_weight', 'viewer')).toBe(true);
  });

  it('catalogs invoice draft routes with accounting minimum and warehouse_manager read support', () => {
    const listEntry = getRoutePermission('/billing/invoice-drafts');
    const detailEntry = getRoutePermission('/billing/invoice-drafts/:draftId');
    const reportEntry = getRoutePermission('/reports/billing-movement-weight');

    expect(listEntry.minimum_role).toBe('accounting');
    expect(detailEntry.minimum_role).toBe('accounting');
    expect(reportEntry.minimum_role).toBe('viewer');
    expect(listEntry.notes).toContain('Gate 3B-RLS');
    expect(reportEntry.notes).toContain('Create Draft requires admin/accounting');
  });

  it('allows warehouse_manager route access via role hierarchy for invoice draft pages', () => {
    expect(canAccessRoute('warehouse_manager', '/billing/invoice-drafts').allowed).toBe(true);
    expect(canAccessRoute('accounting', '/billing/invoice-drafts').allowed).toBe(true);
    expect(canAccessRoute('viewer', '/billing/invoice-drafts').allowed).toBe(false);
    expect(canAccessRoute('warehouse_staff', '/billing/invoice-drafts').allowed).toBe(false);
    expect(canAccessRoute('viewer', '/reports/billing-movement-weight').allowed).toBe(true);
  });
});
