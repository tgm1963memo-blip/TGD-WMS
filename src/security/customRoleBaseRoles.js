// Module-level cache mapping a custom (non-system) role_code — created via
// RolePermissionsAdminPage, stored in tgd_role_definitions — to its
// base_role, so any access-control check written against the 8 built-in
// roles transparently treats a custom-role user the same as their
// underlying permission level. Populated by
// roleAreaPermissionCacheService.refreshRolePermissionCache(), which runs
// on every session load (see UserRoleProvider.jsx), not just when an
// admin happens to open the Roles admin page. No imports — every module
// that needs custom-role resolution (roleAccess.js, roleAreaPermissions.js)
// depends on this leaf, not on each other, to avoid a circular import.
const baseRoleByCode = new Map();

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function setCustomRoleBaseRoles(roleDefinitions = []) {
  baseRoleByCode.clear();
  for (const def of roleDefinitions) {
    const code = normalize(def?.role_code);
    const base = normalize(def?.base_role);
    if (!code || !base || base === code) continue;
    baseRoleByCode.set(code, base);
  }
}

// Returns the resolved base role for a custom role_code, or the
// (normalized) input unchanged if it isn't a custom role — safe to call
// with any of the 8 built-in role codes too.
export function resolveCustomRoleBaseRole(roleCode) {
  const code = normalize(roleCode);
  return baseRoleByCode.get(code) ?? code;
}

// True only for a role_code that is an actual registered custom role (i.e.
// found in tgd_role_definitions with a distinct base_role) — used to teach
// supabaseAuthRoleMappingService's "known role" whitelist about roles
// created after that hardcoded list was written, without ever treating a
// genuinely bogus/mistyped role string as valid.
export function isRegisteredCustomRole(roleCode) {
  return baseRoleByCode.has(normalize(roleCode));
}
