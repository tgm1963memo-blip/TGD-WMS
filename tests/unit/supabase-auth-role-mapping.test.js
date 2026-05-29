import { describe, it, expect } from 'vitest';
import {
  normalizeWmsRole,
  isKnownWmsRole,
  resolveUserProfileRole,
  buildUserProfileQuery,
  createSafeAuthRoleState,
} from '../../src/security/supabaseAuthRoleMappingService.js';

describe('Supabase Auth Role Mapping Service', () => {
  // Known roles
  const knownRoles = ['admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'];

  it('normalizeWmsRole returns known role unchanged', () => {
    knownRoles.forEach(r => {
      expect(normalizeWmsRole(r)).toBe(r);
    });
  });

  it('normalizeWmsRole falls back to viewer for null/undefined/empty', () => {
    expect(normalizeWmsRole(null)).toBe('viewer');
    expect(normalizeWmsRole(undefined)).toBe('viewer');
    expect(normalizeWmsRole('')).toBe('viewer');
  });

  it('normalizeWmsRole falls back to viewer for unknown role', () => {
    expect(normalizeWmsRole('random')).toBe('viewer');
    expect(normalizeWmsRole('ADMINISTRATOR')).toBe('viewer');
  });

  it('isKnownWmsRole recognises known roles only', () => {
    knownRoles.forEach(r => expect(isKnownWmsRole(r)).toBe(true));
    expect(isKnownWmsRole('unknown')).toBe(false);
    expect(isKnownWmsRole('')).toBe(false);
    expect(isKnownWmsRole(null)).toBe(false);
  });

  it('resolveUserProfileRole handles missing profile', () => {
    const result = resolveUserProfileRole(null);
    expect(result.role).toBe('viewer');
    expect(result.reason).toBe('missing_profile');
    expect(result.isKnownRole).toBe(false);
  });

  it('resolveUserProfileRole handles inactive profile', () => {
    const profile = {
      auth_user_id: 'uid123',
      email: 'user@example.com',
      role: 'warehouse_staff',
      customer_id: null,
      is_active: false,
    };
    const result = resolveUserProfileRole(profile);
    expect(result.role).toBe('viewer');
    expect(result.reason).toBe('inactive_profile');
    expect(result.isActive).toBe(false);
  });

  it('resolveUserProfileRole handles unknown role', () => {
    const profile = {
      auth_user_id: 'uid123',
      email: 'user@example.com',
      role: 'super_user',
      customer_id: null,
      is_active: true,
    };
    const result = resolveUserProfileRole(profile);
    expect(result.role).toBe('viewer');
    expect(result.reason).toBe('unknown_role');
    expect(result.isKnownRole).toBe(false);
  });

  it('resolveUserProfileRole resolves active known role correctly', () => {
    const profile = {
      auth_user_id: 'uid123',
      email: 'user@example.com',
      role: 'warehouse_staff',
      customer_id: null,
      is_active: true,
    };
    const result = resolveUserProfileRole(profile);
    expect(result.role).toBe('warehouse_staff');
    expect(result.isKnownRole).toBe(true);
    expect(result.isActive).toBe(true);
    expect(result.canUseAdminFeatures).toBe(false);
  });

  it('resolveUserProfileRole admin requires exact role and active', () => {
    const activeAdmin = {
      auth_user_id: 'uid123',
      email: 'admin@example.com',
      role: 'admin',
      customer_id: null,
      is_active: true,
    };
    const result = resolveUserProfileRole(activeAdmin);
    expect(result.role).toBe('admin');
    expect(result.canUseAdminFeatures).toBe(true);
  });

  it('buildUserProfileQuery returns descriptor when authUserId present', () => {
    const q = buildUserProfileQuery('uid123');
    expect(q).toEqual({ table: 'tgd_user_profiles', match: { auth_user_id: 'uid123' }, limit: 1 });
  });

  it('buildUserProfileQuery blocks when authUserId missing', () => {
    const q = buildUserProfileQuery(null);
    expect(q).toEqual({ blocked: true, reason: 'missing_auth_user_id' });
  });

  it('createSafeAuthRoleState handles unauthenticated user', () => {
    const state = createSafeAuthRoleState({ authUser: null, profile: null });
    expect(state.authenticated).toBe(false);
    expect(state.role).toBe('viewer');
    expect(state.reason).toBe('unauthenticated');
  });

  it('createSafeAuthRoleState handles authenticated user with missing profile', () => {
    const state = createSafeAuthRoleState({ authUser: { id: 'uid123', email: 'u@x.com' }, profile: null });
    expect(state.authenticated).toBe(true);
    expect(state.role).toBe('viewer');
    expect(state.reason).toBe('missing_profile');
    expect(state.profileResolved).toBe(false);
  });

  it('createSafeAuthRoleState resolves active warehouse_staff profile', () => {
    const profile = {
      auth_user_id: 'uid123',
      email: 'staff@x.com',
      role: 'warehouse_staff',
      customer_id: null,
      is_active: true,
    };
    const state = createSafeAuthRoleState({ authUser: { id: 'uid123', email: 'staff@x.com' }, profile });
    expect(state.role).toBe('warehouse_staff');
    expect(state.profileResolved).toBe(true);
    expect(state.canUseAdminFeatures).toBe(false);
  });

  it('createSafeAuthRoleState includes customerId when present', () => {
    const profile = {
      auth_user_id: 'uid123',
      email: 'cust@x.com',
      role: 'warehouse_staff',
      customer_id: 'cust-uuid',
      is_active: true,
    };
    const state = createSafeAuthRoleState({ authUser: { id: 'uid123', email: 'cust@x.com' }, profile });
    expect(state.customerId).toBe('cust-uuid');
  });

  it('service source does not contain forbidden terms', () => {
    const source = typeof normalizeWmsRole === 'function' ? normalizeWmsRole.toString() : '';
    const forbidden = ['sales_order', 'sales_orders', 'so_', 'outbound_orders', 'invoice', 'invoice_lines'];
    forbidden.forEach(term => expect(source).not.toContain(term));
  });
});
