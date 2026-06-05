import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(process.cwd(), 'database/migrations/030_tgd_wms_post_outbound_rpc_draft.sql');
const docPath = path.join(process.cwd(), 'docs/14Z_POST_OUTBOUND_RPC_DRAFT.md');
const pickingPagePath = path.join(process.cwd(), 'src/features/operations/picking/PickingDraftWorkflowPage.jsx');
const controlledPickPagePath = path.join(process.cwd(), 'src/features/operations/picking/ControlledPickConfirmationPage.jsx');
const servicePath = path.join(process.cwd(), 'src/services/outboundPickingService.js');

function readFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

function readMigration() {
  return readFile(migrationPath);
}

function readDoc() {
  return readFile(docPath);
}

describe('Sprint 14Z post outbound RPC draft', () => {
  it('creates migration 030 and future RPC draft', () => {
    const migration = readMigration().toLowerCase();

    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain('create or replace function public.tgd_rpc_post_outbound_document');
    expect(migration).toContain('p_outbound_document_id uuid');
    expect(migration).toContain('p_post_reference text');
    expect(migration).toContain('returns jsonb');
  });

  it('requires post reference, authenticated active user, and authorized warehouse role', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('is_active = true');
    expect(migration).toContain("v_profile.role not in ('admin', 'warehouse_manager')");
    expect(migration).toContain('post_reference is required');
    expect(migration).toContain('outbound_document_id is required');
  });

  it('requires fully picked document with lines and picked reservations', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain("v_document.status <> 'picked'");
    expect(migration).toContain('outbound document has no lines');
    expect(migration).toContain('picked_quantity < l.requested_quantity');
    expect(migration).toContain('outbound document is not fully picked');
    expect(migration).toContain('outbound document has no picked reservations');
  });

  it('includes idempotency and duplicate movement prevention', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('idempotent');
    expect(migration).toContain('same post_reference');
    expect(migration).toContain('different post_reference');
    expect(migration).toContain('uq_tgd_stock_movements_outbound_reservation_post_reference');
    expect(migration).toContain('duplicate stock movement');
    expect(migration).toContain('source_reservation_id');
    expect(migration).toContain('source_reference');
  });

  it('checks stock balance safety and rejects insufficient stock', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('from public.tgd_stock_balances');
    expect(migration).toContain('for update');
    expect(migration).toContain('insufficient stock_balance');
    expect(migration).toContain('coalesce(v_balance.quantity, 0) < v_reservation.picked_quantity');
    expect(migration).not.toMatch(/update\s+public\.tgd_stock_balances/i);
    expect(migration).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('records posted audit fields or documents them when needed', () => {
    const combined = `${readMigration()}\n${readDoc()}`.toLowerCase();

    expect(combined).toContain('posted_by');
    expect(combined).toContain('posted_at');
    expect(combined).toContain('tgd_audit_logs');
    expect(combined).toContain('current balance trigger behavior is quantity-focused');
  });

  it('does not contain destructive SQL patterns', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/\btruncate\b/);
  });

  it('does not add UI post outbound or confirm stock out buttons', () => {
    const source = [
      pickingPagePath,
      controlledPickPagePath,
      servicePath,
    ]
      .filter((filePath) => existsSync(filePath))
      .map((filePath) => readFile(filePath))
      .join('\n');

    expect(source).not.toMatch(/<button[^>]*>\s*post outbound\s*</i);
    expect(source).not.toMatch(/<button[^>]*>\s*confirm stock out\s*</i);
    expect(source).not.toContain("rpc('tgd_rpc_post_outbound_document'");
    expect(source).not.toContain('rpc("tgd_rpc_post_outbound_document"');
  });

  it('documents draft-only scope and next sprint staging apply gate', () => {
    const doc = readDoc().toLowerCase();

    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('migration draft only');
    expect(doc).toContain('no staging apply');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no ui post outbound button');
    expect(doc).toContain('15a post outbound rpc staging apply & smoke');
    expect(doc).toContain('only after controller approval');
  });
});
