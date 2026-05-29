import fs from 'fs';
import path from 'path';
import {
  createRoleAssignmentChecklist,
  normalizeUserRoleAssignment,
  summarizeRoleAssignmentVerification,
  validateUserRoleAssignment,
  verifyUserRoleAssignments,
} from '../../src/security/realUserRoleVerificationService.js';
import { auditProductionAuthReadiness } from '../../src/security/authReadinessAuditService.js';
import { TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';

describe('real user role assignment verification', () => {
  test('valid roles pass', () => {
    const result = verifyUserRoleAssignments([
      { email: 'manager@example.com', role: 'warehouse_manager', evidence: true },
      { email: 'staff@example.com', role: 'warehouse_staff', evidence: true },
      { email: 'accounting@example.com', role: 'accounting', evidence: true },
      { email: 'viewer@example.com', role: 'viewer', evidence: true },
    ]);

    expect(result.ready).toBe(true);
    expect(result.assignments.every((assignment) => assignment.ok)).toBe(true);
  });

  test('missing role becomes viewer', () => {
    const result = normalizeUserRoleAssignment({ email: 'missing@example.com', evidence: true });

    expect(result.role).toBe('viewer');
  });

  test('unknown role becomes viewer', () => {
    const result = normalizeUserRoleAssignment({ email: 'unknown@example.com', role: 'super_user', evidence: true });

    expect(result.role).toBe('viewer');
  });

  test('admin is never default', () => {
    expect(normalizeUserRoleAssignment({}).role).toBe('viewer');
    expect(validateUserRoleAssignment({ role: '' }).role).not.toBe('admin');
  });

  test('admin must be explicit', () => {
    const implicitAdmin = validateUserRoleAssignment({ role: 'admin', evidence: true, reviewedByAdmin: true });
    const explicitAdmin = validateUserRoleAssignment({
      role: 'admin',
      evidence: true,
      explicitAdminAssignment: true,
      reviewedByAdmin: true,
    });

    expect(implicitAdmin.role).toBe('viewer');
    expect(implicitAdmin.warnings.join(' ')).toMatch(/Admin role requires explicit/);
    expect(explicitAdmin.role).toBe('admin');
    expect(explicitAdmin.ok).toBe(true);
  });

  test('summary detects missing evidence', () => {
    const summary = summarizeRoleAssignmentVerification([
      { email: 'viewer@example.com', role: 'viewer' },
    ]);

    expect(summary.ready).toBe(false);
    expect(summary.evidenceMissing).toBe(true);
  });

  test('checklist marks admin review required', () => {
    const checklist = createRoleAssignmentChecklist([
      { email: 'admin@example.com', role: 'admin', explicitAdminAssignment: true, evidence: true },
    ]);
    const adminReview = checklist.find((item) => item.id === 'admin_role_review_required');

    expect(adminReview.ready).toBe(false);
  });

  test('auth readiness audit includes role assignment verification', () => {
    const audit = auditProductionAuthReadiness({
      authProviderConfigured: true,
      userProfileRoleSourceConfigured: true,
      demoRoleSelectorEnabled: false,
      viewerFallbackEnabled: true,
      realUserRoleAssignments: [
        {
          email: 'admin@example.com',
          role: 'admin',
          explicitAdminAssignment: true,
          reviewedByAdmin: true,
          evidence: true,
        },
      ],
    });

    expect(audit.checks.some((check) => check.id === 'REAL_USER_ROLE_ASSIGNMENT_EVIDENCE')).toBe(true);
    expect(audit.checks.some((check) => check.id === 'ADMIN_ROLE_ASSIGNMENTS_REVIEWED')).toBe(true);
    expect(audit.checks.some((check) => check.id === 'NO_ADMIN_DEFAULT')).toBe(true);
  });

  test('Thai/English translation keys exist', () => {
    [
      'real_user_role_verification',
      'user_role_assignment',
      'role_assignment_checklist',
      'admin_role_review_required',
      'missing_role_fallback_viewer',
      'unknown_role_fallback_viewer',
      'no_admin_default',
      'production_role_ready',
      'production_role_not_ready',
      'role_assignment_evidence_required',
      'reviewed_by_admin',
      'verification_status',
    ].forEach((key) => {
      expect(TRANSLATION_CATALOG[key].th).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].en).toBeTruthy();
    });
  });

  test('demo selector production check remains available', () => {
    const audit = auditProductionAuthReadiness({ demoRoleSelectorEnabled: true });

    expect(audit.checks.some((check) => check.id === 'DEMO_SELECTOR_DISABLED')).toBe(true);
  });

  test('service has no persistence, network, or secret access', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/security/realUserRoleVerificationService.js'),
      'utf8',
    );

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/axios/);
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(source).not.toMatch(/SERVICE[_-]?ROLE|SECRET|PRIVATE|PASSWORD|TOKEN/);
  });
});
