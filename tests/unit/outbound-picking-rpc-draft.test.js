import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(process.cwd(), 'database/migrations/026_tgd_wms_outbound_picking_rpc_draft.sql');
const docPath = path.join(process.cwd(), 'docs/14D_OUTBOUND_PICKING_RPC_DRAFT.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14D outbound picking RPC draft', () => {
  it('migration file exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('defines the four safe outbound RPC draft wrappers', () => {
    const source = readMigration();

    expect(source).toContain('tgd_rpc_create_outbound_draft');
    expect(source).toContain('tgd_rpc_add_outbound_line');
    expect(source).toContain('tgd_rpc_reserve_outbound_stock');
    expect(source).toContain('tgd_rpc_release_outbound_reservation');
  });

  it('does not define a post outbound RPC', () => {
    expect(readMigration()).not.toContain('tgd_rpc_post_outbound_document');
  });

  it('does not write stock movements or stock balances', () => {
    const source = readMigration().toLowerCase();

    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/);
    expect(source).not.toMatch(/delete\s+from/);
    expect(source).not.toMatch(/\btruncate\b/);
  });

  it('keeps reservation changes scoped to outbound metadata tables', () => {
    const source = readMigration().toLowerCase();

    expect(source).toMatch(/insert\s+into\s+tgd_outbound_documents/);
    expect(source).toMatch(/insert\s+into\s+tgd_outbound_lines/);
    expect(source).toMatch(/insert\s+into\s+tgd_outbound_reservations/);
    expect(source).toMatch(/update\s+tgd_outbound_lines/);
    expect(source).toMatch(/update\s+tgd_outbound_documents/);
    expect(source).toMatch(/update\s+tgd_outbound_reservations/);
  });

  it('documentation states the 14D safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('no production touched');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('reservation only');
    expect(doc).toContain('does not consume physical stock');
    expect(doc).toContain('stock decrease remains trigger-driven only in a later sprint');
  });
});
