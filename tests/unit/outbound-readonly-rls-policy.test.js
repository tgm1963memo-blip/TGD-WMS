import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(process.cwd(), 'database/migrations/027_tgd_wms_outbound_readonly_rls.sql');
const docPath = path.join(process.cwd(), 'docs/14K_FIX_OUTBOUND_READONLY_RLS_POLICY.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14K outbound read-only RLS policy draft', () => {
  it('creates migration 027', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('references all outbound read-model tables', () => {
    const migration = readMigration();

    expect(migration).toContain('public.tgd_outbound_documents');
    expect(migration).toContain('public.tgd_outbound_lines');
    expect(migration).toContain('public.tgd_outbound_reservations');
  });

  it('keeps RLS enabled and creates SELECT-only policies', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('alter table public.tgd_outbound_documents enable row level security');
    expect(migration).toContain('alter table public.tgd_outbound_lines enable row level security');
    expect(migration).toContain('alter table public.tgd_outbound_reservations enable row level security');
    expect(migration).toContain('create policy rls_outbound_documents_select');
    expect(migration).toContain('create policy rls_outbound_lines_select');
    expect(migration).toContain('create policy rls_outbound_reservations_select');
    expect(migration).toMatch(/for\s+select/);
    expect(migration).toContain('to authenticated');
  });

  it('does not add write policies or dangerous stock mutations', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toContain('for insert');
    expect(migration).not.toContain('for update');
    expect(migration).not.toContain('for delete');
    expect(migration).not.toMatch(/insert\s+into\s+tgd_stock_movements/);
    expect(migration).not.toMatch(/update\s+tgd_stock_balances/);
    expect(migration).not.toMatch(/\btruncate\b/);
  });

  it('revokes direct table writes from frontend roles', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('revoke insert, update, delete on public.tgd_outbound_documents from anon, authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.tgd_outbound_lines from anon, authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.tgd_outbound_reservations from anon, authenticated');
  });

  it('documentation contains required safety statements', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('read-only rls policy only');
    expect(doc).toContain('select only');
    expect(doc).toContain('no insert/update/delete policy');
    expect(doc).toContain('no post outbound');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('migration not applied yet');
  });
});
