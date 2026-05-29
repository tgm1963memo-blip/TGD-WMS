import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/007_adjustment_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 2D adjustment foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const postFunctionSql = migrationSql.match(
    /create or replace function tgd_post_adjustment_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the adjustment foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates adjustment document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_adjustment_documents');
    expect(migrationSql).toContain('create table if not exists tgd_adjustment_lines');
  });

  it('defines adjustment status, type, and direction constraints', () => {
    ['DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    [
      'STOCK_COUNT_GAIN',
      'STOCK_COUNT_LOSS',
      'DAMAGE',
      'EXPIRED',
      'QUALITY_HOLD',
      'QUALITY_RELEASE',
      'SYSTEM_CORRECTION',
      'OTHER',
    ].forEach((adjustmentType) => {
      expect(migrationSql).toContain(`'${adjustmentType}'`);
    });

    expect(migrationSql).toContain('constraint tgd_adjustment_documents_status_check check');
    expect(migrationSql).toContain('constraint tgd_adjustment_documents_type_check check');
    expect(migrationSql).toContain("constraint tgd_adjustment_lines_direction_check check (adjustment_direction in ('IN', 'OUT'))");
  });

  it('creates the adjustment post function', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_adjustment_document');
    expect(postFunctionSql).toContain('adjustment_qty <= 0');
  });

  it('posts through the movement engine as ADJUST_IN or ADJUST_OUT and links movement ids', () => {
    expect(postFunctionSql).toContain('tgd_post_inventory_movement');
    expect(postFunctionSql).toContain("when 'IN' then 'ADJUST_IN'");
    expect(postFunctionSql).toContain("when 'OUT' then 'ADJUST_OUT'");
    expect(postFunctionSql).toContain("'reference_type', 'ADJUSTMENT'");
    expect(postFunctionSql).toContain('movement_id = v_movement_id');
  });

  it('routes IN lines to target fields and OUT lines to source fields', () => {
    expect(postFunctionSql).toContain("'from_warehouse_id', case when v_line.adjustment_direction = 'OUT'");
    expect(postFunctionSql).toContain("'to_warehouse_id', case when v_line.adjustment_direction = 'IN'");
    expect(postFunctionSql).toContain("'reason_code', coalesce(v_line.reason_code, v_document.adjustment_type)");
  });

  it('does not directly update stock balances from adjustment', () => {
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
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_dispatch/i);
  });

  it('does not create Express sync artifacts or rely on legacy-reference content', () => {
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(migrationSql).not.toContain('express');
  });
});

