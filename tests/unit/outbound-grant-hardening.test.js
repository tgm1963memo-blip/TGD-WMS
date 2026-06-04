import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(process.cwd(), 'database/migrations/028_tgd_wms_outbound_grant_hardening.sql');
const docPath = path.join(process.cwd(), 'docs/14K_FIX_2_OUTBOUND_GRANT_HARDENING.md');

const outboundTables = [
  'public.tgd_outbound_documents',
  'public.tgd_outbound_lines',
  'public.tgd_outbound_reservations',
];

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14K-Fix-2 outbound grant hardening draft', () => {
  it('creates migration 028', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('references all outbound read-model tables', () => {
    const migration = readMigration();

    outboundTables.forEach((tableName) => {
      expect(migration).toContain(tableName);
    });
  });

  it('revokes dangerous direct privileges from anon and authenticated', () => {
    const migration = readMigration().toLowerCase();

    outboundTables.forEach((tableName) => {
      const escapedTableName = tableName.replaceAll('.', '\\.');
      expect(migration).toMatch(
        new RegExp(
          `revoke\\s+insert,\\s*update,\\s*delete,\\s*truncate,\\s*references,\\s*trigger\\s+on\\s+${escapedTableName}\\s+from\\s+anon,\\s*authenticated`,
          'i',
        ),
      );
    });
  });

  it('keeps authenticated SELECT only and removes anon direct SELECT', () => {
    const migration = readMigration().toLowerCase();

    outboundTables.forEach((tableName) => {
      const escapedTableName = tableName.replaceAll('.', '\\.');
      expect(migration).toMatch(new RegExp(`grant\\s+select\\s+on\\s+${escapedTableName}\\s+to\\s+authenticated`, 'i'));
      expect(migration).toMatch(new RegExp(`revoke\\s+select\\s+on\\s+${escapedTableName}\\s+from\\s+anon`, 'i'));
    });
  });

  it('does not grant dangerous table privileges to anon or authenticated', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/grant\s+insert\b[\s\S]*\bto\s+(anon|authenticated)/);
    expect(migration).not.toMatch(/grant\s+update\b[\s\S]*\bto\s+(anon|authenticated)/);
    expect(migration).not.toMatch(/grant\s+delete\b[\s\S]*\bto\s+(anon|authenticated)/);
    expect(migration).not.toMatch(/grant\s+truncate\b[\s\S]*\bto\s+(anon|authenticated)/);
  });

  it('does not touch stock tables or run destructive data statements', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toContain('tgd_stock_movements');
    expect(migration).not.toContain('tgd_stock_balances');
    expect(migration).not.toMatch(/\binsert\s+into\b/);
    expect(migration).not.toMatch(/\bupdate\s+public\./);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
    expect(migration).not.toMatch(/\btruncate\s+table\b/);
  });

  it('documentation contains required safety statements', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('grant hardening only');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('no post outbound');
    expect(doc).toContain('authenticated users keep select only');
    expect(doc).toContain('anon has no direct read/write access');
    expect(doc).toContain('truncate');
    expect(doc).toContain('trigger');
    expect(doc).toContain('references');
  });
});
