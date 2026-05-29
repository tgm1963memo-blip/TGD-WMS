/*
 * Supabase Auth Role Mapping Service
 * Foundation for mapping Supabase Auth identities to WMS roles via tgd_user_profiles.
 * No real Supabase connection is performed – all functions are pure logic
 * or return a query descriptor for later execution.
 */

/**
 * List of known WMS roles.
 */
const KNOWN_ROLES = [
  "admin",
  "warehouse_manager",
  "warehouse_staff",
  "accounting",
  "viewer",
];

/**
 * Normalize a role string.
 * - Returns the role unchanged if it is a known role.
 * - Returns "viewer" for null/undefined/empty strings or unknown values.
 * - Admin is only returned when the exact string "admin" is supplied.
 *
 * @param {string|null|undefined} role
 * @returns {string} Normalized role (always one of KNOWN_ROLES)
 */
export function normalizeWmsRole(role) {
  if (!role) return "viewer";
  const trimmed = String(role).trim().toLowerCase();
  if (KNOWN_ROLES.includes(trimmed)) {
    return trimmed;
  }
  return "viewer";
}

/**
 * Check whether a role is a known WMS role.
 * @param {string} role
 * @returns {boolean}
 */
export function isKnownWmsRole(role) {
  if (!role) return false;
  return KNOWN_ROLES.includes(String(role).trim().toLowerCase());
}

/**
 * Resolve a user profile object to an enriched role description.
 * The profile object follows the shape of the `tgd_user_profiles` table.
 *
 * @param {Object|null|undefined} profile
 * @returns {Object} resolution result containing role, flags, and reason.
 */
export function resolveUserProfileRole(profile) {
  // Default viewer response
  const defaultResult = {
    role: "viewer",
    isKnownRole: false,
    isActive: false,
    customerId: null,
    authUserId: null,
    email: null,
    reason: "missing_profile",
    canUseAdminFeatures: false,
  };

  if (!profile) {
    return defaultResult;
  }

  const {
    auth_user_id: authUserId = null,
    email = null,
    role,
    customer_id: customerId = null,
    is_active: isActive = false,
  } = profile;

  // Inactive profile – fallback to viewer
  if (!isActive) {
    return {
      role: "viewer",
      isKnownRole: isKnownWmsRole(role),
      isActive,
      customerId,
      authUserId,
      email,
      reason: "inactive_profile",
      canUseAdminFeatures: false,
    };
  }

  // Unknown role – fallback to viewer
  if (!isKnownWmsRole(role)) {
    return {
      role: "viewer",
      isKnownRole: false,
      isActive,
      customerId,
      authUserId,
      email,
      reason: "unknown_role",
      canUseAdminFeatures: false,
    };
  }

  // Known and active role – normalize (admin only if exact "admin")
  const normalized = normalizeWmsRole(role);
  const canUseAdmin = normalized === "admin";

  return {
    role: normalized,
    isKnownRole: true,
    isActive,
    customerId,
    authUserId,
    email,
    reason: null,
    canUseAdminFeatures: canUseAdmin,
  };
}

/**
 * Build a safe query descriptor for fetching a user profile.
 * This descriptor can be used by a Supabase client elsewhere – no execution here.
 *
 * @param {string|null|undefined} authUserId
 * @returns {Object} query descriptor
 */
export function buildUserProfileQuery(authUserId) {
  if (!authUserId) {
    return { blocked: true, reason: "missing_auth_user_id" };
  }
  return {
    table: "tgd_user_profiles",
    match: { auth_user_id: authUserId },
    limit: 1,
  };
}

/**
 * Create a safe auth role state object from auth user info and an optional profile.
 * This is the shape the application consumes to decide UI visibility and for backend checks.
 *
 * @param {Object} param0
 * @param {Object|null|undefined} param0.authUser – { id, email }
 * @param {Object|null|undefined} param0.profile – raw profile row (may be null)
 * @returns {Object} state description
 */
export function createSafeAuthRoleState({ authUser, profile }) {
  // Unauthenticated case
  if (!authUser || !authUser.id) {
    return {
      authUserId: null,
      email: null,
      role: "viewer",
      customerId: null,
      authenticated: false,
      profileResolved: false,
      canUseAdminFeatures: false,
      reason: "unauthenticated",
    };
  }

  // Build query descriptor (for potential downstream use)
  const query = buildUserProfileQuery(authUser.id);

  // If profile missing, fallback to viewer with reason
  if (!profile) {
    return {
      authUserId: authUser.id,
      email: authUser.email || null,
      role: "viewer",
      customerId: null,
      authenticated: true,
      profileResolved: false,
      canUseAdminFeatures: false,
      reason: "missing_profile",
      profileQuery: query,
    };
  }

  // Resolve using the helper
  const resolved = resolveUserProfileRole(profile);

  return {
    authUserId: authUser.id,
    email: authUser.email || null,
    role: resolved.role,
    customerId: resolved.customerId,
    authenticated: true,
    profileResolved: true,
    canUseAdminFeatures: resolved.canUseAdminFeatures,
    reason: resolved.reason,
    profileQuery: query,
  };
}

/**
 * Exported list for potential future consumption.
 */
export const SERVICE = {
  normalizeWmsRole,
  isKnownWmsRole,
  resolveUserProfileRole,
  buildUserProfileQuery,
  createSafeAuthRoleState,
  KNOWN_ROLES,
};
