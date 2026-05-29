import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/016_stock_count_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');
const handheldFeaturePath = resolve(projectRoot, 'src/features/handheld');

describe('Sprint 4E stock count foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const completeFunctionSql = migrationSql.match(
    /create or replace function tgd_complete_stock_count_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';
  const createAdjustmentFunctionSql = migrationSql.match(
    /create or replace function tgd_create_adjustment_from_stock_count[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates migration 016', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates stock count document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_stock_count_documents');
    expect(migrationSql).toContain('create table if not exists tgd_stock_count_lines');
  });

  it('defines status, count type, and line status constraints', () => {
    expect(migrationSql).toContain('constraint tgd_stock_count_documents_status_check check');
    expect(migrationSql).toContain('constraint tgd_stock_count_documents_type_check check');
    expect(migrationSql).toContain('constraint tgd_stock_count_lines_status_check check');

    ['DRAFT', 'IN_PROGRESS', 'COUNTED', 'APPROVED', 'CANCELLED', 'ADJUSTMENT_CREATED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    ['FULL_COUNT', 'CYCLE_COUNT', 'LOCATION_COUNT', 'PRODUCT_COUNT', 'LOT_COUNT', 'PALLET_COUNT', 'ADHOC'].forEach((type) => {
      expect(migrationSql).toContain(`'${type}'`);
    });

    ['PENDING', 'COUNTED', 'VARIANCE', 'ZERO_COUNT', 'SKIPPED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });
  });

  it('creates stock count completion and adjustment draft functions', () => {
    expect(migrationSql).toContain('create or replace function tgd_complete_stock_count_document');
    expect(migrationSql).toContain('create or replace function tgd_create_adjustment_from_stock_count');
  });

  it('complete function calculates variance and writes audit log', () => {
    expect(completeFunctionSql).toContain('variance_qty = counted_qty - expected_qty');
    expect(completeFunctionSql).toContain("then 'ZERO_COUNT'");
    expect(completeFunctionSql).toContain("then 'COUNTED'");
    expect(completeFunctionSql).toContain("else 'VARIANCE'");
    expect(completeFunctionSql).toContain('tgd_write_audit_log');
  });

  it('adjustment creation creates draft adjustment lines without posting', () => {
    expect(createAdjustmentFunctionSql).toContain('insert into tgd_adjustment_documents');
    expect(createAdjustmentFunctionSql).toContain("'DRAFT'");
    expect(createAdjustmentFunctionSql).toContain('insert into tgd_adjustment_lines');
    expect(createAdjustmentFunctionSql).toContain("case when v_line.variance_qty > 0 then 'IN' else 'OUT' end");
    expect(createAdjustmentFunctionSql).toContain('adjustment_line_id = v_adjustment_line_id');
    expect(createAdjustmentFunctionSql).not.toContain('tgd_post_adjustment_document');
  });

  it('does not update stock balances or post movements', () => {
    [completeFunctionSql, createAdjustmentFunctionSql].forEach((functionSql) => {
      expect(functionSql).not.toMatch(/update\s+tgd_stock_balances/i);
      expect(functionSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
      expect(functionSql).not.toContain('tgd_post_inventory_movement');
    });
    expect(completeFunctionSql).not.toContain('tgd_post_adjustment_document');
  });

  it('does not create handheld UI pages or Express sync artifacts', () => {
    expect(existsSync(handheldFeaturePath)).toBe(true);
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('express');
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
  });
});
