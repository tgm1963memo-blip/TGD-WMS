import { listRoleDefinitions } from './productServiceRatesService.js';
import { listRoleFunctionPermissions } from './roleFunctionPermissionService.js';
import { setRoleFunctionPermissionCache } from '../security/roleFunctionPermissions.js';
import { setRoleAreaPermissionCache } from '../security/roleAreaPermissions.js';
import { listRoleAreaPermissions } from './roleAreaPermissionService.js';

export async function refreshRolePermissionCache() {
  const [functionResult, areaResult, rolesResult] = await Promise.all([
    listRoleFunctionPermissions(),
    listRoleAreaPermissions(),
    listRoleDefinitions(),
  ]);

  if (functionResult.error) {
    return { ok: false, error: functionResult.error };
  }

  const roleDefinitions = rolesResult.data ?? [];

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
}

export const refreshRoleAreaPermissionCache = refreshRolePermissionCache;
