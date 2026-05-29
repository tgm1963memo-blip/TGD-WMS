import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/001_core_master_data.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');

describe('Sprint 1A schema files', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');

  it('creates the core master data migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('defines all required master tables', () => {
    [
      'tgd_customers',
      'tgd_products',
      'tgd_warehouses',
      'tgd_zones',
      'tgd_rooms',
      'tgd_locations',
      'tgd_pallets',
      'tgd_lots',
    ].forEach((tableName) => {
      expect(migrationSql).toContain(`create table if not exists ${tableName}`);
    });
  });

  it('does not create movement ledger or stock balance tables in Sprint 1A', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_movement/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_stock/i);
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
  });
});
