import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildRoleAreaMatrix,
  diffRoleAreaOverrides,
  getDefaultAreaAccess,
  getRoleAreaOverride,
  hasRoleAreaAccess,
  setRoleAreaPermissionCache,
} from '../../src/security/roleAreaPermissions.js';

describe('role area permissions', () => {
  beforeEach(() => {
    setRoleAreaPermissionCache([], []);
  });

  it('uses catalog defaults when no override exists', () => {
    expect(getDefaultAreaAccess('viewer', 'reports')).toBe(true);
    expect(getDefaultAreaAccess('viewer', 'receiving')).toBe(false);
    expect(getDefaultAreaAccess('warehouse_admin', 'customer_portal')).toBe(true);
  });

  it('applies stored overrides for a role and area', () => {
    setRoleAreaPermissionCache([
      { role_code: 'viewer', permission_area: 'receiving', is_allowed: true },
    ], []);

    expect(getRoleAreaOverride('viewer', 'receiving')).toBe(true);
    expect(hasRoleAreaAccess('viewer', 'receiving')).toBe(true);
  });

  it('builds matrix and diffs only non-default overrides', () => {
    const roleCodes = ['viewer', 'warehouse_admin'];
    const { matrix } = buildRoleAreaMatrix(roleCodes, [
      { role_code: 'viewer', permission_area: 'receiving', is_allowed: true },
    ]);

    expect(matrix.viewer.receiving).toBe(true);
    expect(matrix.viewer.reports).toBe(true);

    const diff = diffRoleAreaOverrides('viewer', {
      ...matrix.viewer,
      receiving: false,
      reports: true,
    });

    expect(diff.toUpsert).toEqual([]);
    expect(diff.toDelete).toContain('receiving');
    expect(diff.toDelete).toContain('reports');
  });
});
