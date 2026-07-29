import { listRoleDefinitions } from './productServiceRatesService.js';
import { listRoleFunctionPermissions } from './roleFunctionPermissionService.js';
import { setRoleFunctionPermissionCache } from '../security/roleFunctionPermissions.js';
import { setRoleAreaPermissionCache } from '../security/roleAreaPermissions.js';
import { listRoleAreaPermissions } from './roleAreaPermissionService.js';
import { setCustomRoleBaseRoles } from '../security/customRoleBaseRoles.js';

let _refreshPromise = null;

export async function refreshRolePermissionCache() {
  if (_refreshPromise) {
    return _refreshPromise;
  }

  _refreshPromise = (async () => {
    try {
      const [functionResult, areaResult, rolesResult] = await Promise.all([
        listRoleFunctionPermissions(),
        listRoleAreaPermissions(),
        listRoleDefinitions(),
      ]);

      if (functionResult.error) {
        return { ok: false, error: functionResult.error };
      }

      const roleDefinitions = rolesResult.data ?? [];

      // Populated unconditionally (not gated on the area/function fetches
      // below succeeding) — this is what lets a custom role (e.g. one
      // created in RolePermissionsAdminPage) resolve to its base_role for
      // route/sidebar access checks (see roleAccess.js), not just the
      // admin-configurable permission matrix.
      setCustomRoleBaseRoles(roleDefinitions);

      setRoleFunctionPermissionCache(
        functionResult.data ?? [],
        roleDefinitions,
      );

      if (!areaResult.error) {
        setRoleAreaPermissionCache(
          areaResult.data ?? [],
          roleDefinitions,
        );
      }

      return { ok: true, error: null };
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export const refreshRoleAreaPermissionCache = refreshRolePermissionCache;
