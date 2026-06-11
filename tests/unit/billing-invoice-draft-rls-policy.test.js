import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/039_tgd_wms_billing_invoice_draft_rls_hardening.sql',
);
const accessMatrixPath = path.join(process.cwd(), 'docs/security/tgd-wms-rls-access-matrix.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('Gate 3B-RLS billing invoice draft RLS policy draft', () => {
  it('creates migration 039', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('enables RLS on billing invoice draft tables', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('alter table public.tgd_billing_invoice_drafts enable row level security');
    expect(migration).toContain('alter table public.tgd_billing_invoice_draft_lines enable row level security');
  });

  it('creates SELECT/INSERT/UPDATE policies for draft header and lines', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('create policy rls_billing_invoice_drafts_select');
    expect(migration).toContain('create policy rls_billing_invoice_drafts_insert');
    expect(migration).toContain('create policy rls_billing_invoice_drafts_update');
    expect(migration).toContain('create policy rls_billing_invoice_draft_lines_select');
    expect(migration).toContain('create policy rls_billing_invoice_draft_lines_insert');
    expect(migration).toContain('create policy rls_billing_invoice_draft_lines_update');
    expect(migration).toMatch(/for\s+select/);
    expect(migration).toMatch(/for\s+insert/);
    expect(migration).toMatch(/for\s+update/);
    expect(migration).toContain('to authenticated');
  });

  it('reuses active role and customer helper functions', () => {
    const migration = readMigration();

    expect(migration).toContain('public.tgd_current_user_role()');
    expect(migration).toContain('public.tgd_current_user_is_active()');
    expect(migration).toContain('public.tgd_current_user_customer_id()');
    expect(migration).toContain("'admin', 'accounting', 'warehouse_manager'");
    expect(migration).toContain("'admin', 'accounting'");
  });

  it('does not contain destructive statements', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/drop\s+(table|policy|function|index|schema)/);
    expect(migration).not.toMatch(/truncate\s+table/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/reset\s+/);
  });

  it('documents billing draft access in the RLS access matrix', () => {
    const matrix = readFileSync(accessMatrixPath, 'utf8');

    expect(matrix).toContain('tgd_billing_invoice_drafts');
    expect(matrix).toContain('tgd_billing_invoice_draft_lines');
    expect(matrix).toContain('Gate 3B-RLS');
  });
});
