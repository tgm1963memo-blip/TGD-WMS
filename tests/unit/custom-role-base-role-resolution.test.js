import { describe, expect, it, beforeEach } from 'vitest';
import { setCustomRoleBaseRoles, resolveCustomRoleBaseRole, isRegisteredCustomRole } from '../../src/security/customRoleBaseRoles.js';
import { hasRoleAccess } from '../../src/security/roleAccess.js';
import { isKnownWmsRole, normalizeWmsRole, resolveUserProfileRole } from '../../src/security/supabaseAuthRoleMappingService.js';

// A custom role (e.g. created via RolePermissionsAdminPage — role_code
// 'customer_wh', base_role 'viewer') must be treated the same as its
// base_role by every access check written against the 8 built-in roles —
// otherwise assigning it to a real user locks them out of everything.
describe('custom role base_role resolution', () => {
  beforeEach(() => {
    setCustomRoleBaseRoles([]);
  });

  it('is a no-op when no custom roles are registered', () => {
    expect(resolveCustomRoleBaseRole('viewer')).toBe('viewer');
    expect(resolveCustomRoleBaseRole('unknown_role')).toBe('unknown_role');
    expect(isRegisteredCustomRole('customer_wh')).toBe(false);
  });

  it('resolves a registered custom role to its base_role', () => {
    setCustomRoleBaseRoles([
      { role_code: 'admin', display_name: 'Admin', is_system: true },
      { role_code: 'customer_wh', display_name: 'Ovo-deposit', is_system: false, base_role: 'viewer' },
    ]);

    expect(isRegisteredCustomRole('customer_wh')).toBe(true);
    expect(resolveCustomRoleBaseRole('customer_wh')).toBe('viewer');
    // System roles (base_role === role_code, or none set) are untouched.
    expect(resolveCustomRoleBaseRole('admin')).toBe('admin');
  });

  it('hasRoleAccess treats a custom role the same as its base_role', () => {
    setCustomRoleBaseRoles([
      { role_code: 'ovo-withdraw', is_system: false, base_role: 'viewer' },
    ]);

    expect(hasRoleAccess('ovo-withdraw', 'viewer')).toBe(true);
    expect(hasRoleAccess('ovo-withdraw', 'warehouse_admin')).toBe(false);
    // Without registration, the same string would resolve to hierarchy
    // level 0 and be denied even for the lowest tier.
    setCustomRoleBaseRoles([]);
    expect(hasRoleAccess('ovo-withdraw', 'viewer')).toBe(false);
  });

  it('isKnownWmsRole/normalizeWmsRole recognize a registered custom role', () => {
    setCustomRoleBaseRoles([
      { role_code: 'customer_wh', is_system: false, base_role: 'viewer' },
    ]);

    expect(isKnownWmsRole('customer_wh')).toBe(true);
    expect(normalizeWmsRole('customer_wh')).toBe('customer_wh');

    const resolved = resolveUserProfileRole({
      auth_user_id: 'uid1',
      email: 'a@b.com',
      role: 'customer_wh',
      customer_id: null,
      is_active: true,
    });
    expect(resolved.role).toBe('customer_wh');
    expect(resolved.isKnownRole).toBe(true);
  });

  it('a genuinely unregistered role string still falls back to viewer', () => {
    setCustomRoleBaseRoles([
      { role_code: 'customer_wh', is_system: false, base_role: 'viewer' },
    ]);

    expect(isKnownWmsRole('totally_made_up')).toBe(false);
    expect(normalizeWmsRole('totally_made_up')).toBe('viewer');
  });
});
