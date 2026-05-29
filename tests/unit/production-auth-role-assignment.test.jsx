import React from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import {
  PRODUCTION_ROLES,
  canProductionRoleAccess,
  getProductionRoleRank,
  isValidProductionRole,
  normalizeProductionRole,
} from '../../src/security/productionRoleModel.js';
import {
  resolveUserRoleFromAuthContext,
  resolveUserRoleFromProfile,
  summarizeAuthRoleResolution,
} from '../../src/security/authUserRoleResolver.js';
import {
  auditDemoRoleSelectorRisk,
  auditProductionAuthReadiness,
} from '../../src/security/authReadinessAuditService.js';
import { AuthReadinessPanel } from '../../src/components/security/AuthReadinessPanel.jsx';
import { AuthReadinessPage } from '../../src/features/admin/AuthReadinessPage.jsx';

describe('production role model', () => {
  test('valid production roles are defined', () => {
    expect(PRODUCTION_ROLES).toEqual([
      'viewer',
      'warehouse_staff',
      'warehouse_manager',
      'accounting',
      'admin',
    ]);
    expect(isValidProductionRole('admin')).toBe(true);
    expect(isValidProductionRole('warehouse_manager')).toBe(true);
    expect(isValidProductionRole('warehouse_staff')).toBe(true);
    expect(isValidProductionRole('accounting')).toBe(true);
    expect(isValidProductionRole('viewer')).toBe(true);
  });

  test('role hierarchy works', () => {
    expect(getProductionRoleRank('admin')).toBeGreaterThan(getProductionRoleRank('viewer'));
    expect(canProductionRoleAccess('viewer', 'admin')).toBe(true);
    expect(canProductionRoleAccess('admin', 'viewer')).toBe(false);
    expect(normalizeProductionRole(' Accounting ')).toBe('accounting');
  });
});

describe('auth user role resolver', () => {
  test('invalid role falls back safely', () => {
    const result = resolveUserRoleFromProfile({ role: 'invalid_role' });

    expect(result.role).toBe('viewer');
    expect(result.fallback).toBe(true);
    expect(result.warnings[0]).toMatch(/Invalid production role/);
  });

  test('no admin default', () => {
    const result = resolveUserRoleFromProfile(null);

    expect(result.role).toBe('viewer');
    expect(result.role).not.toBe('admin');
    expect(result.fallback).toBe(true);
  });

  test('viewer fallback when missing auth', () => {
    const result = resolveUserRoleFromAuthContext(undefined);

    expect(result.role).toBe('viewer');
    expect(result.fallback).toBe(true);
  });

  test('summarizes admin assignment with review warning', () => {
    const result = summarizeAuthRoleResolution({ profile: { role: 'admin' } });

    expect(result.role).toBe('admin');
    expect(result.warnings).toContain('Admin role requires explicit production assignment review');
  });
});

describe('auth readiness audit', () => {
  test('auth readiness detects demo selector risk', () => {
    const result = auditDemoRoleSelectorRisk({ enabled: true, environment: 'production' });

    expect(result.riskLevel).toBe('high');
    expect(result.warnings.join(' ')).toMatch(/must not be available in production/);
  });

  test('auth readiness detects service role exposure risk', () => {
    const result = auditProductionAuthReadiness({
      authProviderConfigured: true,
      userProfileRoleSourceConfigured: true,
      demoRoleSelectorEnabled: false,
      viewerFallbackEnabled: true,
      publicEnv: {
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'unsafe',
      },
    });

    expect(result.ready).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/service role/);
  });
});

describe('auth readiness UI', () => {
  test('AuthReadinessPanel renders warning', () => {
    render(<AuthReadinessPanel config={{ demoRoleSelectorEnabled: true }} />);

    expect(screen.getByText('ความพร้อม Production Authentication')).toBeInTheDocument();
    expect(screen.getByText(/Demo role selector is enabled/)).toBeInTheDocument();
  });

  test('AuthReadinessPage renders read-only content', () => {
    render(<AuthReadinessPage />);

    expect(screen.getByText(/ความพร้อมระบบยืนยันตัวตน/)).toBeInTheDocument();
    expect(screen.getByText('Production Role Model')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /update/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
  });

  test('no mutation or external calls exist in sprint files', () => {
    const files = [
      '../../src/security/productionRoleModel.js',
      '../../src/security/authUserRoleResolver.js',
      '../../src/security/authReadinessAuditService.js',
      '../../src/components/security/AuthReadinessPanel.jsx',
      '../../src/features/admin/AuthReadinessPage.jsx',
    ];

    files.forEach((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');

      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/axios/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toMatch(/writeFile/);
      expect(source).not.toMatch(/insert\s*\(/);
      expect(source).not.toMatch(/update\s*\(/);
      expect(source).not.toMatch(/delete\s*\(/);
      expect(source).not.toMatch(/upsert\s*\(/);
      expect(source).not.toMatch(/tgd_post_inventory_movement/);
    });
  });
});
