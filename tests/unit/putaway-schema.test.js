import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/005_putaway_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 2B putaway foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const postFunctionSql = migrationSql.match(
    /create or replace function tgd_post_putaway_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the putaway foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates putaway document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_putaway_documents');
    expect(migrationSql).toContain('create table if not exists tgd_putaway_lines');
  });

  it('defines the putaway status constraint', () => {
    ['DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    expect(migrationSql).toContain('constraint tgd_putaway_documents_status_check check');
  });

  it('includes source receiving line linkage', () => {
    expect(migrationSql).toContain('source_receiving_line_id uuid references tgd_receiving_lines(id)');
    expect(migrationSql).toContain('tgd_putaway_lines_source_receiving_line_id_idx');
  });

  it('creates the putaway post function', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_putaway_document');
    expect(postFunctionSql).toContain('putaway_qty <= 0');
    expect(postFunctionSql).toContain('from_location_id = to_location_id');
  });

  it('posts through the movement engine as PUTAWAY and links movement ids', () => {
    expect(postFunctionSql).toContain('tgd_post_inventory_movement');
    expect(postFunctionSql).toContain("'movement_type', 'PUTAWAY'");
    expect(postFunctionSql).toContain("'reference_type', 'PUTAWAY'");
    expect(postFunctionSql).toContain('movement_id = v_movement_id');
  });

  it('does not directly update stock balances from putaway', () => {
    expect(postFunctionSql).not.toContain('tgd_stock_balances');
    expect(postFunctionSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(postFunctionSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('writes an audit log when posting', () => {
    expect(postFunctionSql).toContain('tgd_write_audit_log');
    expect(postFunctionSql).toContain("'action', 'POST'");
  });

  it('does not create later document workflow tables', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_picking/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_transfer/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_dispatch/i);
  });

  it('does not create Express sync artifacts or rely on legacy-reference content', () => {
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(migrationSql).not.toContain('express');
  });
});

