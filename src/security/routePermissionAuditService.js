// src/security/routePermissionAuditService.js

/**
 * Audit service for the route permission catalog.
 * All functions are pure and have no side effects.
 */

/**
 * Find routes defined in the application that are not present in the catalog.
 * @param {Array<string>} routes - list of route paths from the app.
 * @param {Array<Object>} catalog - the ROUTE_PERMISSION_CATALOG.
 * @returns {Array<string>} uncataloged route paths.
 */
export function findUncatalogedRoutes(routes, catalog) {
  const catalogPaths = new Set(catalog.map((e) => e.route_path));
  return routes.filter((path) => !catalogPaths.has(path));
}

/**
 * Find duplicate route_path entries within the catalog.
 * @param {Array<Object>} catalog
 * @returns {Array<string>} list of duplicate route_path values.
 */
export function findDuplicatePermissionEntries(catalog) {
  const seen = new Set();
  const duplicates = [];
  for (const entry of catalog) {
    if (seen.has(entry.route_path)) {
      duplicates.push(entry.route_path);
    } else {
      seen.add(entry.route_path);
    }
  }
  return duplicates;
}

/**
 * Find catalog entries that have permission_area set to "unknown".
 * @param {Array<Object>} catalog
 * @returns {Array<Object>} entries with unknown area.
 */
export function findRoutesWithUnknownPermissionArea(catalog) {
  return catalog.filter((e) => e.permission_area === 'unknown');
}

/**
 * Find catalog entries missing a minimum_role.
 * @param {Array<Object>} catalog
 * @returns {Array<Object>} entries with missing minimum_role.
 */
export function findRoutesWithMissingMinimumRole(catalog) {
  return catalog.filter((e) => !e.minimum_role);
}

/**
 * Perform a full audit of routes vs catalog.
 * @param {Array<string>} routes - all route paths from the app.
 * @param {Array<Object>} catalog - ROUTE_PERMISSION_CATALOG.
 * @returns {Object} audit result containing all findings.
 */
export function auditRoutePermissionCatalog(routes, catalog) {
  return {
    uncatalogedRoutes: findUncatalogedRoutes(routes, catalog),
    duplicateEntries: findDuplicatePermissionEntries(catalog),
    unknownAreaEntries: findRoutesWithUnknownPermissionArea(catalog),
    missingRoleEntries: findRoutesWithMissingMinimumRole(catalog),
  };
}

/**
 * Summarize audit results into a human‑readable string.
 * @param {Object} auditResult
 * @returns {string}
 */
export function summarizeRoutePermissionAudit(auditResult) {
  const lines = [];
  const { uncatalogedRoutes, duplicateEntries, unknownAreaEntries, missingRoleEntries } = auditResult;
  lines.push(`Uncataloged routes (${uncatalogedRoutes.length}): ${uncatalogedRoutes.join(', ') || 'none'}`);
  lines.push(`Duplicate catalog entries (${duplicateEntries.length}): ${duplicateEntries.join(', ') || 'none'}`);
  lines.push(`Entries with unknown permission area (${unknownAreaEntries.length}): ${unknownAreaEntries.map(e => e.route_path).join(', ') || 'none'}`);
  lines.push(`Entries missing minimum role (${missingRoleEntries.length}): ${missingRoleEntries.map(e => e.route_path).join(', ') || 'none'}`);
  return lines.join('\n');
}
