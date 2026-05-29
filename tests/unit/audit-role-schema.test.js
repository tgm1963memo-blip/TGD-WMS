import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/003_audit_role_foundation.sql');
const policyPath = resolve(projectRoot, 'database/policies/001_rls_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 1C audit and role foundation', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const policySql = readFileSync(policyPath, 'utf8');

  it('creates the audit and role migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates user profile and audit log tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_user_profiles');
    expect(migrationSql).toContain('create table if not exists tgd_audit_logs');
  });

  it('constrains all supported roles', () => {
    [
      'ADMIN',
      'MANAGER',
      'WAREHOUSE_SUPERVISOR',
      'WAREHOUSE_STAFF',
      'VIEWER',
      'AUDITOR',
    ].forEach((role) => {
      expect(migrationSql).toContain(`'${role}'`);
    });

    expect(migrationSql).toContain('constraint tgd_user_profiles_role_check check');
  });

  it('creates audit and permission helper functions', () => {
    [
      'tgd_write_audit_log(input jsonb)',
      'tgd_current_user_role()',
      'tgd_is_admin()',
      'tgd_is_manager_or_admin()',
      'tgd_can_view_inventory()',
      'tgd_can_post_inventory_movement()',
      'tgd_can_view_audit_logs()',
    ].forEach((functionName) => {
      expect(migrationSql).toContain(`create or replace function ${functionName}`);
    });
  });

  it('creates the RLS policy foundation file', () => {
    expect(statSync(policyPath).isFile()).toBe(true);
  });

  it('enables RLS for expected tables', () => {
    [
      'tgd_customers',
      'tgd_products',
      'tgd_warehouses',
      'tgd_zones',
      'tgd_rooms',
      'tgd_locations',
      'tgd_pallets',
      'tgd_lots',
      'tgd_inventory_movements',
      'tgd_stock_balances',
      'tgd_user_profiles',
      'tgd_audit_logs',
    ].forEach((tableName) => {
      expect(policySql).toContain(`alter table ${tableName} enable row level security`);
    });
  });

  it('includes draft policies for inventory, movement, audit, and user profiles', () => {
    expect(policySql).toContain('tgd_can_view_inventory()');
    expect(policySql).toContain('tgd_can_post_inventory_movement()');
    expect(policySql).toContain('tgd_can_view_audit_logs()');
    expect(policySql).toContain('tgd_user_profiles_self_view_policy');
    expect(policySql).toContain('tgd_user_profiles_admin_update_policy');
  });

  it('does not create document workflow tables or Express sync artifacts', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_receiving/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_picking/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_transfer/i);
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(policySql).not.toContain('legacy-reference');
  });
});

