import {
  isValidProductionRole,
  normalizeProductionRole,
  summarizeProductionRole,
} from './productionRoleModel.js';

export function createFallbackViewerRole(reason = 'No authenticated role available') {
  return {
    role: 'viewer',
    fallback: true,
    warnings: [reason],
    source: 'fallback',
  };
}

export function resolveUserRoleFromProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return createFallbackViewerRole('No authenticated profile found');
  }

  const role = normalizeProductionRole(profile.role || profile.user_role || profile.app_role);

  if (!isValidProductionRole(role)) {
    return createFallbackViewerRole(`Invalid production role: ${role || 'missing'}`);
  }

  return {
    role,
    fallback: false,
    warnings: [],
    source: 'profile',
  };
}

export function resolveUserRoleFromAuthContext(authContext) {
  if (!authContext || typeof authContext !== 'object') {
    return createFallbackViewerRole('No authenticated context found');
  }

  const profile = authContext.profile || authContext.userProfile || authContext.user_profile;
  const profileResult = resolveUserRoleFromProfile(profile);

  if (!profileResult.fallback) {
    return {
      ...profileResult,
      source: 'auth_context_profile',
    };
  }

  const metadataRole = authContext.user?.app_metadata?.role
    || authContext.user?.user_metadata?.role
    || authContext.role;
  const role = normalizeProductionRole(metadataRole);

  if (!isValidProductionRole(role)) {
    return createFallbackViewerRole(profileResult.warnings[0] || 'No valid role found in auth context');
  }

  return {
    role,
    fallback: false,
    warnings: [],
    source: 'auth_context_metadata',
  };
}

export function validateAuthRoleAssignment(authContext) {
  const resolution = resolveUserRoleFromAuthContext(authContext);
  const warnings = [...resolution.warnings];

  if (resolution.role === 'admin') {
    warnings.push('Admin role requires explicit production assignment review');
  }

  return {
    ok: !resolution.fallback,
    role: resolution.role,
    fallback: resolution.fallback,
    source: resolution.source,
    warnings,
  };
}

export function summarizeAuthRoleResolution(authContext) {
  const validation = validateAuthRoleAssignment(authContext);
  const roleSummary = summarizeProductionRole(validation.role);

  return {
    ...validation,
    roleSummary,
    safeDefaultApplied: validation.fallback && validation.role === 'viewer',
  };
}
