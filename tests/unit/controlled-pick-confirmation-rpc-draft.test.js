import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/029_tgd_wms_controlled_pick_confirmation_rpc_draft.sql',
);
const docPath = path.join(process.cwd(), 'docs/14T_CONTROLLED_PICK_CONFIRMATION_RPC_DRAFT.md');
const servicePath = path.join(process.cwd(), 'src/services/outboundPickingService.js');
const srcDir = path.join(process.cwd(), 'src');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

function readService() {
  return readFileSync(servicePath, 'utf8');
}

function readAllSrcFiles(dir = srcDir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let contents = '';

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      contents += readAllSrcFiles(fullPath);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      contents += readFileSync(fullPath, 'utf8');
    }
  }

  return contents;
}

describe('Sprint 14T controlled pick confirmation RPC draft', () => {
  it('migration file exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('creates tgd_rpc_confirm_outbound_pick_draft', () => {
    expect(readMigration()).toContain('tgd_rpc_confirm_outbound_pick_draft');
  });

  it('validates picked_quantity > 0', () => {
    const source = readMigration().toLowerCase();

    expect(source).toContain('picked_quantity must be greater than zero');
  });

  it('validates picked_weight >= 0', () => {
    const source = readMigration().toLowerCase();

    expect(source).toContain('picked_weight must be zero or greater');
  });

  it('requires ACTIVE reservation', () => {
    const source = readMigration().toLowerCase();

    expect(source).toContain('reservation status must be active');
  });

  it('rejects RELEASED reservation', () => {
    expect(readMigration()).toContain('RELEASED reservation cannot be picked');
  });

  it('rejects CANCELLED reservation', () => {
    expect(readMigration()).toContain('CANCELLED reservation cannot be picked');
  });

  it('prevents picked_quantity over reserved_quantity', () => {
    expect(readMigration()).toContain('picked_quantity must not exceed reserved_quantity');
  });

  it('prevents line picked_quantity over requested_quantity', () => {
    expect(readMigration()).toContain('line picked_quantity must not exceed requested_quantity');
  });

  it('does NOT contain insert into tgd_stock_movements', () => {
    expect(readMigration().toLowerCase()).not.toMatch(/insert\s+into\s+tgd_stock_movements/);
  });

  it('does NOT contain update tgd_stock_balances', () => {
    expect(readMigration().toLowerCase()).not.toMatch(/update\s+tgd_stock_balances/);
  });

  it('does NOT contain tgd_rpc_post_outbound_document', () => {
    expect(readMigration()).not.toContain('tgd_rpc_post_outbound_document');
  });

  it('does NOT contain delete from', () => {
    expect(readMigration().toLowerCase()).not.toMatch(/delete\s+from/);
  });

  it('does NOT contain truncate', () => {
    expect(readMigration().toLowerCase()).not.toMatch(/\btruncate\b/);
  });

  it('service wrapper exists and calls the draft RPC', () => {
    const source = readService();

    expect(source).toContain('confirmOutboundPickDraft');
    expect(source).toContain('tgd_rpc_confirm_outbound_pick_draft');
    expect(source).toContain('postOutboundDocumentDraft');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
  });



  it('documentation states 14T safety boundaries', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc().toLowerCase();

    expect(doc).toContain('migration draft only');
    expect(doc).toContain('no staging apply');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('no post outbound');
    expect(doc).toContain('no ui confirm pick button');
    expect(doc).toContain('14u controlled pick confirmation staging apply');
    expect(doc).toContain('controller approval');
  });
});
