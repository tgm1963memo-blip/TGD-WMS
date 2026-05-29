// tests/unit/rls-policy-foundation.test.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../../');
const sqlPath = path.join(projectRoot, 'database/policies/002_tgd_wms_rls_policy_foundation.sql');
const readmePath = path.join(projectRoot, 'database/policies/README.md');
const policyDocPath = path.join(projectRoot, 'docs/security/tgd-wms-rls-policy-foundation.md');
const matrixDocPath = path.join(projectRoot, 'docs/security/tgd-wms-rls-access-matrix.md');

function fileContent(p) {
  return fs.readFileSync(p, { encoding: 'utf8' });
}

describe('RLS Policy Foundation file validation', () => {
  it('policy sql file exists', () => {
    expect(fs.existsSync(sqlPath)).toBe(true);
  });

  it('readme and documentation files exist', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
    expect(fs.existsSync(policyDocPath)).toBe(true);
    expect(fs.existsSync(matrixDocPath)).toBe(true);
  });

  it('sql enables RLS on core tables', () => {
    const content = fileContent(sqlPath);
    const tables = [
      'tgd_customers',
      'tgd_stock_balances',
      'tgd_stock_movements',
      'tgd_user_profiles',
      'tgd_audit_logs',
    ];
    tables.forEach(t => {
      expect(content).toContain(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
    });
  });

  it('sql references auth.uid() and user profile table', () => {
    const content = fileContent(sqlPath);
    expect(content).toContain('auth.uid()');
    expect(content).toContain('tgd_user_profiles');
  });

  it('sql includes all required role names', () => {
    const content = fileContent(sqlPath);
    const roles = ['admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'];
    roles.forEach(r => {
      expect(content).toContain(r);
    });
  });

  it('sql contains customer_id isolation comment', () => {
    const content = fileContent(sqlPath);
    expect(content.toLowerCase()).toContain('customer_id');
  });

  it('sql does not contain forbidden sales terms', () => {
    const content = fileContent(sqlPath).toLowerCase();
    const forbidden = [
      'sales_order',
      'sales_orders',
      'so_',
      'outbound_orders',
      'invoice',
      'invoice_lines',
    ];
    forbidden.forEach(term => {
      expect(content).not.toContain(term);
    });
  });

  it('sql does not create functions or triggers', () => {
    const content = fileContent(sqlPath).toUpperCase();
    expect(content).not.toContain('CREATE FUNCTION');
    expect(content).not.toContain('CREATE TRIGGER');
  });

  it('sql contains service_role warning comment', () => {
    const content = fileContent(sqlPath);
    expect(content).toContain('service_role');
  });
});
