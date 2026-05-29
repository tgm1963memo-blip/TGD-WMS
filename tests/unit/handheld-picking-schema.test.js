import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/015_handheld_picking_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');
const handheldFeaturePath = resolve(projectRoot, 'src/features/handheld');

describe('Sprint 4D handheld picking foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const recordScanSql = migrationSql.match(
    /create or replace function tgd_record_handheld_picking_scan[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';
  const completeSessionSql = migrationSql.match(
    /create or replace function tgd_complete_handheld_picking_session[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates migration 015', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates handheld picking session and scan tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_handheld_picking_sessions');
    expect(migrationSql).toContain('create table if not exists tgd_handheld_picking_scans');
  });

  it('defines session, scan step, and validation status constraints', () => {
    expect(migrationSql).toContain('constraint tgd_handheld_picking_sessions_status_check check');
    expect(migrationSql).toContain('constraint tgd_handheld_picking_scans_step_check check');
    expect(migrationSql).toContain('constraint tgd_handheld_picking_scans_validation_status_check check');

    ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    ['DOCUMENT', 'LINE', 'PRODUCT', 'LOT', 'PALLET', 'LOCATION', 'QTY', 'CONFIRM', 'OTHER'].forEach((step) => {
      expect(migrationSql).toContain(`'${step}'`);
    });

    ['PENDING', 'VALID', 'INVALID', 'WARNING', 'SKIPPED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });
  });

  it('creates handheld picking functions', () => {
    expect(migrationSql).toContain('create or replace function tgd_record_handheld_picking_scan');
    expect(migrationSql).toContain('create or replace function tgd_complete_handheld_picking_session');
  });

  it('record scan function logs through barcode scan foundation', () => {
    expect(recordScanSql).toContain('tgd_log_barcode_scan');
    expect(recordScanSql).toContain("'scan_context', 'PICKING'");
    expect(recordScanSql).toContain("'scan_source', 'HANDHELD'");
    expect(recordScanSql).toContain("'related_document_type', 'PICKING_DOCUMENT'");
  });

  it('record scan function inserts handheld scan rows', () => {
    expect(recordScanSql).toContain('insert into tgd_handheld_picking_scans');
    expect(recordScanSql).toContain('validation_status');
    expect(recordScanSql).toContain('scan_event_id');
  });

  it('complete session function writes audit log', () => {
    expect(completeSessionSql).toContain('tgd_write_audit_log');
    expect(completeSessionSql).toContain("'action', 'COMPLETE'");
    expect(completeSessionSql).toContain("set status = 'COMPLETED'");
  });

  it('does not update stock, post movement, confirm picking, dispatch, or use pick confirm', () => {
    [recordScanSql, completeSessionSql].forEach((functionSql) => {
      expect(functionSql).not.toMatch(/update\s+tgd_stock_balances/i);
      expect(functionSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
      expect(functionSql).not.toContain('tgd_post_inventory_movement');
      expect(functionSql).not.toContain('tgd_confirm_picking_document');
      expect(functionSql).not.toContain('tgd_post_dispatch_document');
      expect(functionSql).not.toContain('PICK_CONFIRM');
    });
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
