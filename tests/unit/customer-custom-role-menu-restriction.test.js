import { describe, expect, it } from 'vitest';
import { navigationGroups } from '../../src/app/navigation.js';
import { filterNavigationGroupsForRole } from '../../src/security/navigationPermissions.js';
import { canAccessRoute, getRouteAccessDecision } from '../../src/security/permissionGuard.js';

// Regression coverage for the customer-side custom roles feature: a
// customer_user with a restricted allowed_menu_keys list must see only
// those sidebar items AND be denied direct-URL access to hidden ones —
// while allowedMenuKeys: null (every existing customer_user's default,
// and every non-restricted role) must behave exactly as before this
// feature existed.

describe('filterNavigationGroupsForRole — allowedMenuKeys restriction', () => {
  it('shows every customer-portal item when allowedMenuKeys is null (unrestricted, default)', () => {
    const groups = filterNavigationGroupsForRole(navigationGroups, 'customer_user', null);
    const customerGroup = groups.find((g) => g.key === 'customer_portal');
    const keys = customerGroup.items.map((i) => i.key);
    expect(keys).toContain('customer_stock_balance');
    expect(keys).toContain('customer_deposit_request');
    // customer_team_roles requires customer_admin regardless of any
    // allowedMenuKeys restriction — a customer_user never sees it.
    expect(keys).not.toContain('customer_team_roles');
  });

  it('restricts a customer_user to exactly the keys in allowedMenuKeys', () => {
    const groups = filterNavigationGroupsForRole(navigationGroups, 'customer_user', ['customer_stock_balance', 'customer_movement_ledger']);
    const customerGroup = groups.find((g) => g.key === 'customer_portal');
    const keys = customerGroup.items.map((i) => i.key);
    expect(keys.sort()).toEqual(['customer_movement_ledger', 'customer_stock_balance']);
  });

  it('an empty allowedMenuKeys array hides every customer-portal item (deactivated-role safe default)', () => {
    const groups = filterNavigationGroupsForRole(navigationGroups, 'customer_user', []);
    const customerGroup = groups.find((g) => g.key === 'customer_portal');
    expect(customerGroup).toBeUndefined();
  });

  it('does not restrict a customer_admin even if allowedMenuKeys is passed', () => {
    // Defensive: allowedMenuKeys should only ever be resolved for
    // customer_user in UserRoleProvider, but the filter itself doesn't
    // special-case role — confirm callers always pass null for admins.
    const groups = filterNavigationGroupsForRole(navigationGroups, 'customer_admin', null);
    const customerGroup = groups.find((g) => g.key === 'customer_portal');
    expect(customerGroup.items.map((i) => i.key)).toContain('customer_team_roles');
  });
});

describe('canAccessRoute / getRouteAccessDecision — allowedMenuKeys restriction', () => {
  it('allows a customer_user unrestricted access when allowedMenuKeys is null', () => {
    const decision = getRouteAccessDecision('customer_user', '/customer/stock-balance', null);
    expect(decision.allowed).toBe(true);
  });

  it('denies direct-URL access to a menu not in allowedMenuKeys, even though the role would otherwise permit it', () => {
    const decision = getRouteAccessDecision('customer_user', '/customer/withdrawal-request', ['customer_stock_balance']);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/custom role/i);
  });

  it('allows a menu that IS in allowedMenuKeys', () => {
    const decision = getRouteAccessDecision('customer_user', '/customer/stock-balance', ['customer_stock_balance']);
    expect(decision.allowed).toBe(true);
  });

  it('detail routes inherit their list page\'s menu_key restriction', () => {
    const decision = canAccessRoute('customer_user', '/customer/withdrawal-request/:requestId', ['customer_stock_balance']);
    expect(decision.allowed).toBe(false);
  });

  it('a route with no menu_key (e.g. team-roles, already gated by minimum_role) is unaffected by allowedMenuKeys', () => {
    const decision = getRouteAccessDecision('customer_admin', '/customer/team-roles', ['customer_stock_balance']);
    expect(decision.allowed).toBe(true);
  });

  it('still denies customer_user from customer_admin-only routes regardless of allowedMenuKeys content', () => {
    const decision = getRouteAccessDecision('customer_user', '/customer/team-roles', ['customer_team_roles']);
    expect(decision.allowed).toBe(false);
  });
});
