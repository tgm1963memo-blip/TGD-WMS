import { groupRoutesByPermissionArea } from './routePermissionCatalog.js';
import { hasRoleAccess, roleThresholdLevel } from './roleAccess.js';

const overridesByRole = new Map();
const baseRoleByCode = new Map();

const AREA_MIN_ROLE_CACHE = new Map();

export function getAreaMinimumRole(permissionArea) {
  const area = String(permissionArea ?? '');
  if (AREA_MIN_ROLE_CACHE.has(area)) {
    return AREA_MIN_ROLE_CACHE.get(area);
  }

  const routes = groupRoutesByPermissionArea()[area] ?? [];
  if (!routes.length) {
    AREA_MIN_ROLE_CACHE.set(area, 'admin');
    return 'admin';
  }

  const minRole = routes.reduce((currentMin, entry) => {
    if (roleThresholdLevel(entry.minimum_role) < roleThresholdLevel(currentMin)) {
      return entry.minimum_role;
    }
    return currentMin;
  }, routes[0].minimum_role);

  AREA_MIN_ROLE_CACHE.set(area, minRole);
  return minRole;
}

export function resolveRoleForDefaults(roleCode) {
  const code = String(roleCode ?? '').trim().toLowerCase();
  if (!code) return 'viewer';
  if (code === 'admin') return 'admin';
  return baseRoleByCode.get(code) ?? code;
}

export function getDefaultAreaAccess(roleCode, permissionArea) {
  const role = resolveRoleForDefaults(roleCode);
  const area = String(permissionArea ?? '');

  if (normalizeRoleCode(roleCode) === 'admin') {
    return area !== 'customer_portal';
  }

  const routes = groupRoutesByPermissionArea()[area] ?? [];
  if (!routes.length) {
    return hasRoleAccess(role, 'admin');
  }

  return routes.some((entry) => hasRoleAccess(role, entry.minimum_role));
}

function normalizeRoleCode(roleCode) {
  return String(roleCode ?? '').trim().toLowerCase();
}

export function setRoleAreaPermissionCache(rows = [], roleDefinitions = []) {
  overridesByRole.clear();
  baseRoleByCode.clear();

  for (const row of rows) {
    const roleCode = normalizeRoleCode(row.role_code);
    const area = String(row.permission_area ?? '');
    if (!roleCode || !area) continue;
    if (!overridesByRole.has(roleCode)) {
      overridesByRole.set(roleCode, new Map());
    }
    overridesByRole.get(roleCode).set(area, Boolean(row.is_allowed));
  }

  for (const def of roleDefinitions) {
    const roleCode = normalizeRoleCode(def.role_code);
    if (!roleCode) continue;
    if (def.base_role && def.base_role !== roleCode) {
      baseRoleByCode.set(roleCode, normalizeRoleCode(def.base_role));
    }
  }
}

export function getRoleAreaOverride(roleCode, permissionArea) {
  const role = normalizeRoleCode(roleCode);
  const area = String(permissionArea ?? '');
  const roleOverrides = overridesByRole.get(role);
  if (!roleOverrides || !roleOverrides.has(area)) {
    return undefined;
  }
  return roleOverrides.get(area);
}

export function hasRoleAreaAccess(roleCode, permissionArea) {
  const role = normalizeRoleCode(roleCode);
  const area = String(permissionArea ?? '');

  if (role === 'admin') {
    return area === 'customer_portal' ? false : true;
  }

  const override = getRoleAreaOverride(role, area);
  if (override !== undefined) {
    return override;
  }

  return getDefaultAreaAccess(role, area);
}

export function listPermissionAreas() {
  return Object.keys(groupRoutesByPermissionArea()).filter((area) => area !== 'unknown');
}

export function buildRoleAreaMatrix(roleCodes = [], overrides = []) {
  const overrideMap = new Map();
  for (const row of overrides) {
    const key = `${normalizeRoleCode(row.role_code)}:${row.permission_area}`;
    overrideMap.set(key, Boolean(row.is_allowed));
  }

  const areas = listPermissionAreas();
  const matrix = {};

  for (const roleCode of roleCodes) {
    const role = normalizeRoleCode(roleCode);
    matrix[role] = {};
    for (const area of areas) {
      const key = `${role}:${area}`;
      if (overrideMap.has(key)) {
        matrix[role][area] = overrideMap.get(key);
      } else {
        matrix[role][area] = getDefaultAreaAccess(role, area);
      }
    }
  }

  return { areas, matrix };
}

export function diffRoleAreaOverrides(roleCode, desiredMatrix = {}) {
  const role = normalizeRoleCode(roleCode);
  const toUpsert = [];
  const toDelete = [];

  for (const [area, isAllowed] of Object.entries(desiredMatrix)) {
    const defaultAllowed = getDefaultAreaAccess(role, area);
    const wantsAllowed = Boolean(isAllowed);
    if (wantsAllowed === defaultAllowed) {
      toDelete.push(area);
    } else {
      toUpsert.push({ permission_area: area, is_allowed: wantsAllowed });
    }
  }

  return { toUpsert, toDelete };
}
