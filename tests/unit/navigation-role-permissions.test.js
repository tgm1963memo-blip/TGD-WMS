import { describe, expect, it } from 'vitest';
import {
  filterNavigationGroupsForRole,
  isNavigationItemVisibleForRole,
  isNavigationPathVisibleForRole,
} from '../../src/security/navigationPermissions.js';
import { navigationGroups } from '../../src/app/navigation.js';
import { hasRoleAccess } from '../../src/security/permissionGuard.js';

function visibleLabelsForRole(role) {
  return filterNavigationGroupsForRole(navigationGroups, role)
    .flatMap((group) => group.items.map((item) => item.label));
}

describe('navigation role permissions', () => {
  it('supports customer role access rules in permission guard', () => {
    expect(hasRoleAccess('customer_user', 'customer_user')).toBe(true);
    expect(hasRoleAccess('customer_admin', 'customer_user')).toBe(true);
    expect(hasRoleAccess('warehouse_staff', 'customer_user')).toBe(false);
    expect(hasRoleAccess('customer_user', 'warehouse_staff')).toBe(false);
    expect(hasRoleAccess('admin', 'customer_user')).toBe(true);
  });

  it('warehouse_staff sees handheld only', () => {
    const labels = visibleLabelsForRole('warehouse_staff');

    expect(labels).not.toContain('Dashboard');
    expect(labels).not.toContain('Receiving');
    expect(labels).toContain('Scan Center');
    expect(labels).not.toContain('Portal Overview');
  });

  it('warehouse_admin sees deposit, withdrawal, and stock balance menus', () => {
    const labels = visibleLabelsForRole('warehouse_admin');

    expect(labels).toContain('Receiving');
    expect(labels).toContain('Withdrawal Request');
    expect(labels).toContain('Stock Balance');
    expect(labels).not.toContain('Transfer');
    expect(labels).not.toContain('Scan Center');
    expect(labels).not.toContain('Adjustment');
  });

  it('warehouse_manager sees all warehouse operation menus', () => {
    const labels = visibleLabelsForRole('warehouse_manager');

    expect(labels).toContain('Adjustment');
    expect(labels).toContain('Stock Balance');
    expect(labels).toContain('Transfer');
    expect(labels).toContain('Scan Center');
    expect(labels).toContain('Receiving');
    expect(labels).not.toContain('Master Data');
    expect(labels).not.toContain('Invoice Drafts');
  });

  it('accounting sees billing and reports but not warehouse operations or dashboard', () => {
    const labels = visibleLabelsForRole('accounting');

    expect(labels).not.toContain('Dashboard');
    expect(labels).toContain('Billing Movement Weight');
    expect(labels).toContain('Invoice Drafts');
    expect(labels).toContain('Movement Ledger');
    expect(labels).not.toContain('Receiving');
    expect(labels).not.toContain('Post Outbound');
    expect(labels).not.toContain('Portal Overview');
  });

  it('viewer sees reports only', () => {
    const labels = visibleLabelsForRole('viewer');

    expect(labels).not.toContain('Dashboard');
    expect(labels).toContain('Movement Ledger');
    expect(labels).not.toContain('Receiving');
    expect(labels).not.toContain('Master Data');
    expect(labels).not.toContain('Invoice Drafts');
    expect(labels).not.toContain('Portal Overview');
  });

  it('customer_admin sees customer portal only', () => {
    const labels = visibleLabelsForRole('customer_admin');

    expect(labels).not.toContain('Dashboard');
    expect(labels).toContain('Portal Overview');
    expect(labels).toContain('Customer Deposit');
    expect(labels).toContain('Customer Products');
    expect(labels).not.toContain('Receiving');
    expect(labels).not.toContain('Billing Movement Weight');
    expect(labels).not.toContain('Master Data');
  });

  it('admin sees administration, warehouse menus, and dashboard', () => {
    const labels = visibleLabelsForRole('admin');

    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Receiving');
    expect(labels).toContain('User Management');
    expect(labels).toContain('Portal Overview');
    expect(labels).toContain('Invoice Drafts');
  });

  it('allows warehouse admin to access deposit review route without showing customer portal menu', () => {
    expect(isNavigationPathVisibleForRole('warehouse_admin', '/customer/admin/deposit-review')).toBe(true);
    expect(isNavigationItemVisibleForRole(
      { key: 'customer_portal_home', label: 'Portal Overview', path: '/customer' },
      'customer_portal',
      'warehouse_admin',
    )).toBe(false);
  });
});
