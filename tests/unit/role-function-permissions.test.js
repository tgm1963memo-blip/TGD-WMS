import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildRoleFunctionMatrix,
  diffRoleFunctionOverrides,
  getDefaultFunctionAccess,
  getRoleFunctionOverride,
  hasRoleFunctionAccess,
  setRoleFunctionPermissionCache,
} from '../../src/security/roleFunctionPermissions.js';
import { canAccessRoute } from '../../src/security/permissionGuard.js';

describe('role function permissions', () => {
  beforeEach(() => {
    setRoleFunctionPermissionCache([], []);
  });

  it('uses navigation defaults when no override exists', () => {
    expect(getDefaultFunctionAccess('viewer', 'movement_ledger')).toBe(true);
    expect(getDefaultFunctionAccess('viewer', 'receiving')).toBe(false);
    expect(getDefaultFunctionAccess('warehouse_admin', 'receiving')).toBe(true);
  });

  it('applies stored overrides for a role and function', () => {
    setRoleFunctionPermissionCache([
      { role_code: 'viewer', function_key: 'receiving', is_allowed: true },
    ], []);

    expect(getRoleFunctionOverride('viewer', 'receiving')).toBe(true);
    expect(hasRoleFunctionAccess('viewer', 'receiving')).toBe(true);
    expect(canAccessRoute('viewer', '/operations/receiving').allowed).toBe(true);
  });

  it('can deny access through override even when hierarchy allows', () => {
    setRoleFunctionPermissionCache([
      { role_code: 'warehouse_admin', function_key: 'movement_ledger', is_allowed: false },
    ], []);

    expect(canAccessRoute('warehouse_admin', '/reports/movement-ledger').allowed).toBe(false);
  });

  it('builds matrix and diffs only non-default overrides', () => {
    const roleCodes = ['viewer', 'warehouse_admin'];
    const { matrix } = buildRoleFunctionMatrix(roleCodes, [
      { role_code: 'viewer', function_key: 'receiving', is_allowed: true },
    ]);

    expect(matrix.viewer.receiving).toBe(true);

    const diff = diffRoleFunctionOverrides('viewer', {
      ...matrix.viewer,
      receiving: false,
    });

    expect(diff.toUpsert).toEqual([]);
    expect(diff.toDelete).toContain('receiving');
  });
});
