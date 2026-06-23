import { navigationGroups } from '../app/navigation.js';
import { getRoutePermission } from './routePermissionCatalog.js';
import { resolveNavigationItemPath } from './navigationPaths.js';

const FUNCTION_BY_KEY = new Map();
const FUNCTIONS_BY_PATH = new Map();

function registerFunction(entry) {
  FUNCTION_BY_KEY.set(entry.functionKey, entry);
  const path = entry.path;
  if (!path) return;
  if (!FUNCTIONS_BY_PATH.has(path)) {
    FUNCTIONS_BY_PATH.set(path, []);
  }
  FUNCTIONS_BY_PATH.get(path).push(entry.functionKey);
}

function buildCatalog() {
  if (FUNCTION_BY_KEY.size > 0) {
    return;
  }

  for (const group of navigationGroups) {
    for (const item of group.items) {
      const path = resolveNavigationItemPath(item);
      if (!path) continue;
      const routeEntry = getRoutePermission(path);
      registerFunction({
        functionKey: item.key,
        label: item.label,
        groupKey: group.key,
        groupLabel: group.label,
        path,
        minimumRole: routeEntry?.minimum_role ?? null,
      });
    }
  }
}

export function listNavigationPermissionFunctions() {
  buildCatalog();
  return [...FUNCTION_BY_KEY.values()];
}

export function getNavigationPermissionFunction(functionKey) {
  buildCatalog();
  return FUNCTION_BY_KEY.get(String(functionKey ?? '')) ?? null;
}

export function getFunctionKeysForPath(routePath) {
  buildCatalog();
  const path = String(routePath ?? '');
  const exact = FUNCTIONS_BY_PATH.get(path) ?? [];
  if (exact.length) return exact;

  const matches = [];
  for (const [catalogPath, keys] of FUNCTIONS_BY_PATH.entries()) {
    if (catalogPath.includes(':')) continue;
    if (path === catalogPath || path.startsWith(`${catalogPath}/`)) {
      matches.push(...keys);
    }
  }
  return [...new Set(matches)];
}

export function listNavigationPermissionFunctionsByGroup() {
  const grouped = new Map();
  for (const fn of listNavigationPermissionFunctions()) {
    if (!grouped.has(fn.groupKey)) {
      grouped.set(fn.groupKey, {
        groupKey: fn.groupKey,
        groupLabel: fn.groupLabel,
        items: [],
      });
    }
    grouped.get(fn.groupKey).items.push(fn);
  }
  return [...grouped.values()];
}
