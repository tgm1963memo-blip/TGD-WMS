import {
  createRoleAssignmentChecklist,
  summarizeRoleAssignmentVerification,
  validateUserRoleAssignment,
} from './realUserRoleVerificationService.js';

const SECRET_KEY_PATTERNS = [
  /SERVICE[_-]?ROLE/i,
  /SECRET/i,
  /PRIVATE/i,
  /PASSWORD/i,
  /TOKEN/i,
  /DATABASE[_-]?URL/i,
];

function hasForbiddenKey(config = {}) {
  const env = config.env || config.publicEnv || {};
  return Object.keys(env).some((key) => SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key)));
}

function createCheck(id, ready, message) {
  return {
    id,
    ready,
    status: ready ? 'ready' : 'warning',
    message,
  };
}

export function auditProductionAuthReadiness(config = {}) {
  const roleAssignments = config.realUserRoleAssignments || config.userRoleAssignments || [];
  const roleSummary = summarizeRoleAssignmentVerification(roleAssignments);
  const missingRoleCheck = validateUserRoleAssignment({});
  const unknownRoleCheck = validateUserRoleAssignment({ role: 'unknown_role', evidence: true });
  const checks = [
    createCheck(
      'AUTH_PROVIDER_CONFIGURED',
      Boolean(config.authProviderConfigured),
      'Production authentication provider must be configured before full production.',
    ),
    createCheck(
      'USER_PROFILE_ROLE_SOURCE',
      Boolean(config.userProfileRoleSourceConfigured),
      'Authenticated user profile role source must be defined.',
    ),
    createCheck(
      'DEMO_SELECTOR_DISABLED',
      config.demoRoleSelectorEnabled !== true,
      'Demo role selector must be disabled before production.',
    ),
    createCheck(
      'REAL_USER_ROLE_ASSIGNMENT_EVIDENCE',
      roleSummary.totalAssignments > 0 && !roleSummary.evidenceMissing,
      'Real user role assignment evidence must exist before production.',
    ),
    createCheck(
      'ADMIN_ROLE_ASSIGNMENTS_REVIEWED',
      !roleSummary.adminReviewRequired,
      'Admin role assignments must be explicitly reviewed.',
    ),
    createCheck(
      'MISSING_ROLE_FALLBACK_VIEWER',
      missingRoleCheck.role === 'viewer',
      'Missing role must fall back to viewer.',
    ),
    createCheck(
      'UNKNOWN_ROLE_FALLBACK_VIEWER',
      unknownRoleCheck.role === 'viewer',
      'Unknown role must fall back to viewer.',
    ),
    createCheck(
      'NO_ADMIN_DEFAULT',
      missingRoleCheck.role !== 'admin' && unknownRoleCheck.role !== 'admin',
      'Admin must never be the default role.',
    ),
    createCheck(
      'VIEWER_FALLBACK',
      config.viewerFallbackEnabled !== false,
      'Missing or invalid roles must fall back to viewer.',
    ),
    createCheck(
      'NO_SERVICE_ROLE_EXPOSURE',
      !hasForbiddenKey(config),
      'Frontend config must not expose service role, private, token, password, or database keys.',
    ),
  ];

  const warnings = checks.filter((check) => !check.ready).map((check) => check.message);

  return {
    ready: warnings.length === 0,
    checks,
    roleAssignmentSummary: roleSummary,
    roleAssignmentChecklist: createRoleAssignmentChecklist(roleAssignments),
    warnings,
  };
}

export function auditRoleAssignmentReadiness(users = []) {
  const rows = Array.isArray(users) ? users : [];
  const adminUsers = rows.filter((user) => user?.role === 'admin');
  const accountingUsers = rows.filter((user) => user?.role === 'accounting');
  const warehouseUsers = rows.filter((user) => (
    user?.role === 'warehouse_manager' || user?.role === 'warehouse_staff'
  ));
  const usersMissingRole = rows.filter((user) => !user?.role);

  const warnings = [];

  if (adminUsers.length === 0) warnings.push('Admin assignment review required.');
  if (accountingUsers.length === 0) warnings.push('Accounting role review required.');
  if (warehouseUsers.length === 0) warnings.push('Warehouse role review required.');
  if (usersMissingRole.length > 0) warnings.push('Some users are missing production roles.');

  return {
    ready: warnings.length === 0,
    totalUsers: rows.length,
    adminUsers: adminUsers.length,
    accountingUsers: accountingUsers.length,
    warehouseUsers: warehouseUsers.length,
    usersMissingRole: usersMissingRole.length,
    warnings,
  };
}

export function auditDemoRoleSelectorRisk(options = {}) {
  const enabled = options.enabled === true;
  const production = options.environment === 'production' || options.isProduction === true;
  const warnings = [];

  if (enabled) {
    warnings.push('Demo role selector is enabled and must be retired before production.');
  }

  if (enabled && production) {
    warnings.push('Demo role selector must not be available in production.');
  }

  return {
    riskLevel: enabled && production ? 'high' : enabled ? 'medium' : 'low',
    enabled,
    production,
    warnings,
  };
}

export function summarizeAuthReadiness(auditResult) {
  const result = auditResult || {};
  const warnings = result.warnings || [];

  return {
    ready: result.ready === true,
    warningCount: warnings.length,
    status: result.ready === true ? 'ready' : 'requires_review',
    warnings,
  };
}
