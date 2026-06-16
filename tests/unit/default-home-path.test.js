import { describe, expect, it } from 'vitest';
import { resolveDefaultHomePath } from '../../src/security/defaultHomePath.js';

describe('defaultHomePath', () => {
  it('routes customer roles to customer portal home', () => {
    expect(resolveDefaultHomePath('customer_user')).toBe('/customer');
    expect(resolveDefaultHomePath('customer_admin')).toBe('/customer');
  });

  it('routes admin to dashboard and warehouse staff to receiving', () => {
    expect(resolveDefaultHomePath('admin')).toBe('/dashboard');
    expect(resolveDefaultHomePath('warehouse_staff')).toBe('/operations/receiving');
  });
});
