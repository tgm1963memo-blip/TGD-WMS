import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/042_uat_foundation_remediation_draft.sql',
);
const reviewDocPath = path.join(
  process.cwd(),
  'docs/UAT_FOUNDATION_REMEDIATION_1_SCHEMA_DRIFT_REVIEW.md',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('UAT-FOUNDATION-REMEDIATION-1 draft', () => {
  it('creates remediation review doc and 042 draft migration', () => {
    expect(existsSync(reviewDocPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('marks 042 as UAT-only draft and not for Production', () => {
    const migration = readMigration();

    expect(migration).toContain('UAT-FOUNDATION-REMEDIATION-1');
    expect(migration).toContain('Do NOT apply to Production');
    expect(migration).toMatch(/UAT-only|UAT draft only/i);
  });

  it('creates set_updated_at that only updates updated_at', () => {
    const migration = readMigration();

    expect(migration).toContain('create or replace function public.set_updated_at()');
    expect(migration).toContain('new.updated_at = now()');
    expect(migration).not.toMatch(/tgd_stock_movements/i);
    expect(migration).not.toMatch(/tgd_stock_balances/i);
  });

  it('adds canonical picking documents shell additively for 041 FK', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('create table if not exists public.tgd_picking_documents');
    expect(migration).toContain('tgd_picking_documents_status_check');
    expect(migration).not.toMatch(/create\s+table[^\n]*tgd_picking_lines/i);
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function[^\n]*tgd_confirm_picking_document/i);
    expect(migration).not.toMatch(/references public\.tgd_withdrawal_allocations/i);
  });

  it('defers allocation FK and full 010 RPC explicitly', () => {
    const migration = readMigration();

    expect(migration).toContain('allocation_id uuid');
    expect(migration).toMatch(/deferred.*009|009.*deferred/i);
    expect(migration).toMatch(/full 010.*separate gate/i);
  });

  it('does not contain destructive statements or forbidden logic', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/drop\s+table/);
    expect(migration).not.toMatch(/truncate\s+table/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/reset\s+/);
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
    expect(migration).not.toContain('tgd_post_dispatch_document');
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function[^\n]*tgd_confirm_picking_document/i);
    expect(migration).not.toContain('service_role');
    expect(migration).not.toMatch(/production\s+apply/i);
  });

  it('review doc documents drift, options, and re-run checklist', () => {
    const doc = readFileSync(reviewDocPath, 'utf8');

    expect(doc).toContain('set_updated_at');
    expect(doc).toContain('tgd_picking_documents');
    expect(doc).toContain('tgd_picking_tasks');
    expect(doc).toContain('Option A');
    expect(doc).toContain('Option C');
    expect(doc).toContain('CUSTOMER-PORTAL-2D');
    expect(doc).toContain('Gate 3B-5');
  });
});
