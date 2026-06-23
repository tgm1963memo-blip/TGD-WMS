import { listNavigationPermissionFunctions } from './navigationPermissionCatalog.js';
import { isLegacyNavigationItemVisibleForRole } from './legacyNavigationVisibility.js';
import { resolveRoleForDefaults } from './roleAreaPermissions.js';

const overridesByRole = new Map();
const baseRoleByCode = new Map();

function normalizeRoleCode(roleCode) {
  return String(roleCode ?? '').trim().toLowerCase();
}

export function setRoleFunctionPermissionCache(rows = [], roleDefinitions = []) {
  overridesByRole.clear();
  baseRoleByCode.clear();

  for (const row of rows) {
    const roleCode = normalizeRoleCode(row.role_code);
    const functionKey = String(row.function_key ?? '');
    if (!roleCode || !functionKey) continue;
    if (!overridesByRole.has(roleCode)) {
      overridesByRole.set(roleCode, new Map());
    }
    overridesByRole.get(roleCode).set(functionKey, Boolean(row.is_allowed));
  }

  for (const def of roleDefinitions) {
    const roleCode = normalizeRoleCode(def.role_code);
    if (!roleCode) continue;
    if (def.base_role && def.base_role !== roleCode) {
      baseRoleByCode.set(roleCode, normalizeRoleCode(def.base_role));
    }
  }
}

export function getRoleFunctionOverride(roleCode, functionKey) {
  const role = normalizeRoleCode(roleCode);
  const key = String(functionKey ?? '');
  const roleOverrides = overridesByRole.get(role);
  if (!roleOverrides || !roleOverrides.has(key)) {
    return undefined;
  }
  return roleOverrides.get(key);
}

export function getDefaultFunctionAccess(roleCode, functionKey) {
  const role = normalizeRoleCode(roleCode);
  const key = String(functionKey ?? '');

  if (role === 'admin') {
    return true;
  }

  const fn = listNavigationPermissionFunctions().find((entry) => entry.functionKey === key);
  if (!fn) {
    return false;
  }

  const baseRole = resolveRoleForDefaults(roleCode);
  return isLegacyNavigationItemVisibleForRole(
    { key: fn.functionKey, path: fn.path },
    fn.groupKey,
    baseRole,
  );
}

export function hasRoleFunctionAccess(roleCode, functionKey) {
  const role = normalizeRoleCode(roleCode);
  const key = String(functionKey ?? '');

  if (role === 'admin') {
    return true;
  }

  const override = getRoleFunctionOverride(role, key);
  if (override !== undefined) {
    return override;
  }

  return getDefaultFunctionAccess(role, key);
}

export function listPermissionFunctions() {
  return listNavigationPermissionFunctions();
}

export function buildRoleFunctionMatrix(roleCodes = [], overrides = []) {
  const overrideMap = new Map();
  for (const row of overrides) {
    const mapKey = `${normalizeRoleCode(row.role_code)}:${row.function_key}`;
    overrideMap.set(mapKey, Boolean(row.is_allowed));
  }

  const functions = listPermissionFunctions().map((fn) => fn.functionKey);
  const matrix = {};

  for (const roleCode of roleCodes) {
    const role = normalizeRoleCode(roleCode);
    matrix[role] = {};
    for (const functionKey of functions) {
      const mapKey = `${role}:${functionKey}`;
      matrix[role][functionKey] = overrideMap.has(mapKey)
        ? overrideMap.get(mapKey)
        : getDefaultFunctionAccess(role, functionKey);
    }
  }

  return { functions, matrix };
}

export function diffRoleFunctionOverrides(roleCode, desiredMatrix = {}) {
  const role = normalizeRoleCode(roleCode);
  const toUpsert = [];
  const toDelete = [];

  for (const [functionKey, isAllowed] of Object.entries(desiredMatrix)) {
    const defaultAllowed = getDefaultFunctionAccess(role, functionKey);
    const wantsAllowed = Boolean(isAllowed);
    if (wantsAllowed === defaultAllowed) {
      toDelete.push(functionKey);
    } else {
      toUpsert.push({ function_key: functionKey, is_allowed: wantsAllowed });
    }
  }

  return { toUpsert, toDelete };
}

export function diffAllRoleFunctionOverrides(baselineMatrix = {}, draftMatrix = {}) {
  const changedRoles = [];
  const roleCodes = new Set([
    ...Object.keys(baselineMatrix ?? {}),
    ...Object.keys(draftMatrix ?? {}),
  ]);

  for (const roleCode of roleCodes) {
    if (normalizeRoleCode(roleCode) === 'admin') continue;
    const baseline = baselineMatrix[roleCode] ?? {};
    const draft = draftMatrix[roleCode] ?? {};
    if (!draftsAreEqual(baseline, draft)) {
      changedRoles.push({
        roleCode,
        diff: diffRoleFunctionOverrides(roleCode, draft),
      });
    }
  }

  return changedRoles;
}

function draftsAreEqual(left, right) {
  const keys = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
  for (const key of keys) {
    if (Boolean(left?.[key]) !== Boolean(right?.[key])) {
      return false;
    }
  }
  return true;
}

export { draftsAreEqual as functionDraftsAreEqual };

export function matrixDraftsAreEqual(leftMatrix = {}, rightMatrix = {}) {
  const roleCodes = new Set([
    ...Object.keys(leftMatrix ?? {}),
    ...Object.keys(rightMatrix ?? {}),
  ]);
  for (const roleCode of roleCodes) {
    if (!draftsAreEqual(leftMatrix[roleCode], rightMatrix[roleCode])) {
      return false;
    }
  }
  return true;
}
