import { describe, expect, it } from 'vitest';
import { resolveDefaultHomePath } from '../../src/security/defaultHomePath.js';

describe('defaultHomePath', () => {
  it('routes customer roles to customer portal home', () => {
    expect(resolveDefaultHomePath('customer_user')).toBe('/customer');
    expect(resolveDefaultHomePath('customer_admin')).toBe('/customer');
  });

  it('routes admin to dashboard and warehouse staff to handheld', () => {
    expect(resolveDefaultHomePath('admin')).toBe('/dashboard');
    expect(resolveDefaultHomePath('warehouse_staff')).toBe('/handheld');
    expect(resolveDefaultHomePath('warehouse_admin')).toBe('/operations/receiving');
  });

  it('sends a restricted customer_user to the first menu they can actually see, not the fixed portal home', () => {
    // A custom role (see CustomerTeamRolesPage) whose allowed_menu_keys
    // doesn't include 'customer_portal_home' must not land on a page that
    // immediately shows PermissionDeniedNotice right after login.
    expect(resolveDefaultHomePath('customer_user', ['customer_deposit_request', 'customer_stock_balance']))
      .toBe('/customer/deposit-request');
    expect(resolveDefaultHomePath('customer_user', ['customer_stock_balance', 'customer_withdrawal_request']))
      .toBe('/customer/stock-balance');
  });

  it('keeps /customer as home when the restricted role does allow the portal home', () => {
    expect(resolveDefaultHomePath('customer_user', ['customer_portal_home', 'customer_stock_balance']))
      .toBe('/customer');
  });

  it('falls back to the profile page when a restricted role has no allowed customer-portal menus', () => {
    expect(resolveDefaultHomePath('customer_user', [])).toBe('/settings/profile');
  });

  it('is unrestricted (null allowedMenuKeys) by default, matching every existing customer_user', () => {
    expect(resolveDefaultHomePath('customer_user', null)).toBe('/customer');
  });
});
