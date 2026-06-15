import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAuthenticatedUserRole,
  getCurrentUserRole,
  PRODUCTION_FALLBACK_ROLE,
  setAuthenticatedUserRole,
  setDemoUserRole,
} from '../../src/security/currentUserRole.js';

describe('authenticated user role resolution', () => {
  beforeEach(() => {
    clearAuthenticatedUserRole();
    setDemoUserRole('admin');
  });

  it('prefers authenticated profile role over demo selector default', () => {
    setAuthenticatedUserRole('accounting');
    expect(getCurrentUserRole()).toBe('accounting');
  });

  it('falls back to demo role when no authenticated profile role is set', () => {
    expect(getCurrentUserRole()).toBe('admin');
  });

  it('supports customer portal roles from profile mapping', () => {
    setAuthenticatedUserRole('customer_admin');
    expect(getCurrentUserRole()).toBe('customer_admin');
  });

  it('clears authenticated role back to demo/default path', () => {
    setAuthenticatedUserRole('accounting');
    clearAuthenticatedUserRole();
    expect(getCurrentUserRole()).toBe('admin');
  });
});
