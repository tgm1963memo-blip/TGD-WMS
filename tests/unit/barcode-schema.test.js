import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/012_barcode_scan_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');
const handheldFeaturePath = resolve(projectRoot, 'src/features/handheld');
const barcodeFeaturePath = resolve(projectRoot, 'src/features/barcode');

describe('Sprint 4A barcode scan foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const resolverSql = migrationSql.match(
    /create or replace function tgd_resolve_barcode[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';
  const loggerSql = migrationSql.match(
    /create or replace function tgd_log_barcode_scan[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates migration 012', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates barcode alias and scan event tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_barcode_aliases');
    expect(migrationSql).toContain('create table if not exists tgd_barcode_scan_events');
  });

  it('defines entity type and barcode type constraints', () => {
    expect(migrationSql).toContain('constraint tgd_barcode_aliases_entity_type_check check');
    expect(migrationSql).toContain('constraint tgd_barcode_aliases_barcode_type_check check');
    expect(migrationSql).toContain('constraint tgd_barcode_aliases_value_not_empty check');

    ['PRODUCT', 'LOCATION', 'PALLET', 'LOT', 'WITHDRAWAL_REQUEST', 'DISPATCH_LINE', 'USER', 'OTHER'].forEach((entityType) => {
      expect(migrationSql).toContain(`'${entityType}'`);
    });

    ['PRIMARY', 'ALIAS', 'SUPPLIER', 'CUSTOMER', 'INTERNAL', 'HANDHELD_LABEL', 'OTHER'].forEach((barcodeType) => {
      expect(migrationSql).toContain(`'${barcodeType}'`);
    });
  });

  it('defines scan context, result, and source constraints', () => {
    expect(migrationSql).toContain('constraint tgd_barcode_scan_events_context_check check');
    expect(migrationSql).toContain('constraint tgd_barcode_scan_events_result_check check');
    expect(migrationSql).toContain('constraint tgd_barcode_scan_events_source_check check');

    ['GENERAL', 'RECEIVING', 'PUTAWAY', 'PICKING', 'DISPATCH', 'STOCK_COUNT', 'LOGIN'].forEach((context) => {
      expect(migrationSql).toContain(`'${context}'`);
    });

    ['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS', 'ERROR', 'IGNORED'].forEach((result) => {
      expect(migrationSql).toContain(`'${result}'`);
    });

    ['WEB', 'HANDHELD', 'MOBILE', 'API', 'SYSTEM', 'OTHER'].forEach((source) => {
      expect(migrationSql).toContain(`'${source}'`);
    });
  });

  it('creates resolver and scan logger functions', () => {
    expect(migrationSql).toContain('create or replace function tgd_resolve_barcode');
    expect(migrationSql).toContain('create or replace function tgd_log_barcode_scan');
  });

  it('resolver searches products, locations, and pallets', () => {
    expect(resolverSql).toContain('from tgd_products product');
    expect(resolverSql).toContain('from tgd_locations location');
    expect(resolverSql).toContain('from tgd_pallets pallet');
    expect(resolverSql).toContain('product.barcode = v_scan_value');
    expect(resolverSql).toContain('location.barcode = v_scan_value');
    expect(resolverSql).toContain('pallet.barcode = v_scan_value');
  });

  it('resolver and scan logger do not post movements or update stock balances', () => {
    expect(resolverSql).not.toContain('tgd_post_inventory_movement');
    expect(loggerSql).not.toContain('tgd_post_inventory_movement');
    expect(resolverSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(loggerSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(migrationSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('scan logger inserts auditable scan events', () => {
    expect(loggerSql).toContain('insert into tgd_barcode_scan_events');
    expect(loggerSql).toContain('resolved_entity_type');
    expect(loggerSql).toContain('resolved_entity_id');
    expect(loggerSql).toContain('error_message');
  });

  it('does not create handheld UI pages or Express sync artifacts', () => {
    expect(existsSync(handheldFeaturePath)).toBe(true);
    expect(existsSync(barcodeFeaturePath)).toBe(false);
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('express');
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
  });
});
