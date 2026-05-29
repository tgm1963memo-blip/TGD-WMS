import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/006_transfer_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 2C transfer foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const postFunctionSql = migrationSql.match(
    /create or replace function tgd_post_transfer_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the transfer foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates transfer document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_transfer_documents');
    expect(migrationSql).toContain('create table if not exists tgd_transfer_lines');
  });

  it('defines transfer status and type constraints', () => {
    ['DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    [
      'INTERNAL',
      'ROOM_TRANSFER',
      'PALLET_TRANSFER',
      'LOCATION_TRANSFER',
      'QUALITY_HOLD_TRANSFER',
    ].forEach((transferType) => {
      expect(migrationSql).toContain(`'${transferType}'`);
    });

    expect(migrationSql).toContain('constraint tgd_transfer_documents_status_check check');
    expect(migrationSql).toContain('constraint tgd_transfer_documents_type_check check');
  });

  it('creates the transfer post function', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_transfer_document');
    expect(postFunctionSql).toContain('transfer_qty <= 0');
  });

  it('checks same source and target identity', () => {
    expect(migrationSql).toContain('constraint tgd_transfer_lines_source_target_change_check check');
    expect(postFunctionSql).toContain('from_location_id = to_location_id');
    expect(postFunctionSql).toContain('from_pallet_id is not distinct from to_pallet_id');
  });

  it('posts through the movement engine as TRANSFER and links movement ids', () => {
    expect(postFunctionSql).toContain('tgd_post_inventory_movement');
    expect(postFunctionSql).toContain("'movement_type', 'TRANSFER'");
    expect(postFunctionSql).toContain("'reference_type', 'TRANSFER'");
    expect(postFunctionSql).toContain('movement_id = v_movement_id');
  });

  it('does not directly update stock balances from transfer', () => {
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

