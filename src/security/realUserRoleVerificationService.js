import {
  PRODUCTION_ROLES,
  isValidProductionRole,
  normalizeProductionRole,
} from './productionRoleModel.js';

export const REAL_USER_ROLE_FALLBACK = 'viewer';

function hasEvidence(input = {}) {
  return Boolean(
    input.evidence === true
      || input.evidenceReference
      || input.evidenceDocument
      || input.reviewTicket
      || input.reviewedAt,
  );
}

function hasAdminReview(input = {}) {
  return Boolean(input.reviewedByAdmin === true || input.adminReviewed === true);
}

function hasExplicitAdminAssignment(input = {}) {
  return Boolean(input.explicitAdminAssignment === true || input.adminExplicit === true);
}

export function normalizeUserRoleAssignment(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const inputRole = source.role ?? source.userRole ?? source.appRole;
  const normalizedInputRole = normalizeProductionRole(inputRole);
  const validRole = isValidProductionRole(normalizedInputRole);
  const explicitAdmin = normalizedInputRole === 'admin' && hasExplicitAdminAssignment(source);
  const role = validRole && normalizedInputRole !== 'admin'
    ? normalizedInputRole
    : explicitAdmin
      ? 'admin'
      : REAL_USER_ROLE_FALLBACK;

  return {
    userId: source.userId || source.id || '',
    email: source.email || '',
    displayName: source.displayName || source.name || '',
    inputRole: inputRole || '',
    role,
    validRole,
    roleWasFallback: role === REAL_USER_ROLE_FALLBACK && normalizedInputRole !== REAL_USER_ROLE_FALLBACK,
    evidenceProvided: hasEvidence(source),
    reviewedByAdmin: hasAdminReview(source),
    explicitAdminAssignment: explicitAdmin,
    source: source.source || 'manual_review',
  };
}

export function validateUserRoleAssignment(input = {}) {
  const assignment = normalizeUserRoleAssignment(input);
  const warnings = [];

  if (!assignment.inputRole) {
    warnings.push('Missing role falls back to viewer.');
  }

  if (assignment.inputRole && !assignment.validRole) {
    warnings.push('Unknown role falls back to viewer.');
  }

  if (normalizeProductionRole(assignment.inputRole) === 'admin' && !assignment.explicitAdminAssignment) {
    warnings.push('Admin role requires explicit assignment evidence.');
  }

  if (!assignment.evidenceProvided) {
    warnings.push('Role assignment evidence is required.');
  }

  if (assignment.role === 'admin' && !assignment.reviewedByAdmin) {
    warnings.push('Admin role assignment must be reviewed by admin.');
  }

  return {
    ...assignment,
    ok: warnings.length === 0,
    warnings,
  };
}

export function verifyUserRoleAssignments(assignments = []) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const verifiedAssignments = rows.map((assignment) => validateUserRoleAssignment(assignment));
  const warnings = verifiedAssignments.flatMap((assignment) => assignment.warnings);
  const adminAssignments = verifiedAssignments.filter((assignment) => assignment.role === 'admin');
  const fallbackAssignments = verifiedAssignments.filter((assignment) => assignment.roleWasFallback);
  const assignmentsMissingEvidence = verifiedAssignments.filter((assignment) => !assignment.evidenceProvided);

  return {
    ready: rows.length > 0 && warnings.length === 0,
    totalAssignments: rows.length,
    supportedRoles: [...PRODUCTION_ROLES],
    assignments: verifiedAssignments,
    adminAssignments,
    fallbackAssignments,
    assignmentsMissingEvidence,
    warnings,
  };
}

export function summarizeRoleAssignmentVerification(assignments = []) {
  const verification = verifyUserRoleAssignments(assignments);
  const adminReviewRequired = verification.adminAssignments.some((assignment) => !assignment.reviewedByAdmin);
  const evidenceMissing = verification.totalAssignments === 0 || verification.assignmentsMissingEvidence.length > 0;

  return {
    status: verification.ready ? 'production_role_ready' : 'production_role_not_ready',
    ready: verification.ready,
    totalAssignments: verification.totalAssignments,
    adminAssignments: verification.adminAssignments.length,
    fallbackAssignments: verification.fallbackAssignments.length,
    evidenceMissing,
    adminReviewRequired,
    warnings: verification.warnings,
  };
}

export function createRoleAssignmentChecklist(assignments = []) {
  const summary = summarizeRoleAssignmentVerification(assignments);

  return [
    {
      id: 'role_assignment_evidence_required',
      label: 'Role assignment evidence required',
      ready: !summary.evidenceMissing,
      status: summary.evidenceMissing ? 'requires_review' : 'ready',
    },
    {
      id: 'admin_role_review_required',
      label: 'Admin role assignments reviewed',
      ready: !summary.adminReviewRequired,
      status: summary.adminReviewRequired ? 'requires_review' : 'ready',
    },
    {
      id: 'missing_role_fallback_viewer',
      label: 'Missing role falls back to viewer',
      ready: true,
      status: 'ready',
    },
    {
      id: 'unknown_role_fallback_viewer',
      label: 'Unknown role falls back to viewer',
      ready: true,
      status: 'ready',
    },
    {
      id: 'no_admin_default',
      label: 'Admin is never the default role',
      ready: true,
      status: 'ready',
    },
  ];
}
