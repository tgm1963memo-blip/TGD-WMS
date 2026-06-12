import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/040_tgd_wms_customer_portal_source_documents.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2B customer portal source document migration draft', () => {
  it('creates migration 040 draft file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('defines required customer portal tables', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('create table if not exists public.tgd_customer_deposit_requests');
    expect(migration).toContain('create table if not exists public.tgd_customer_deposit_request_lines');
    expect(migration).toContain('create table if not exists public.tgd_customer_withdrawal_requests');
    expect(migration).toContain('create table if not exists public.tgd_customer_withdrawal_request_lines');
    expect(migration).toContain('create table if not exists public.tgd_customer_document_attachments');
    expect(migration).toContain('create table if not exists public.tgd_customer_document_timeline_events');
  });

  it('includes deposit and withdrawal status checks', () => {
    const migration = readMigration();

    expect(migration).toContain("'SUBMITTED_BY_CUSTOMER'");
    expect(migration).toContain("'ADMIN_ACCEPTED'");
    expect(migration).toContain("'RECEIVING_VARIANCE'");
    expect(migration).toContain("'WITHDRAWAL_DRAFT'");
    expect(migration).toContain("'WAREHOUSE_PICKING'");
    expect(migration).toContain("'LOADED_CONFIRMED'");
    expect(migration).toContain("picking_rule in ('FEFO', 'SPECIFIC_DEPOSIT', 'SPECIFIC_LOT')");
  });

  it('includes multi-admin audit fields on headers', () => {
    const migration = readMigration();

    expect(migration).toContain('created_by_user_id');
    expect(migration).toContain('created_by_email');
    expect(migration).toContain('created_by_display_name');
    expect(migration).toContain('submitted_by_user_id');
    expect(migration).toContain('last_action_by_user_id');
    expect(migration).toContain('actor_user_id');
    expect(migration).toContain('actor_customer_id');
  });

  it('enables RLS and reuses customer helper functions', () => {
    const migration = readMigration();

    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.tgd_current_user_role()');
    expect(migration).toContain('public.tgd_current_user_customer_id()');
    expect(migration).toContain('public.tgd_current_user_is_active()');
    expect(migration).toContain("'customer_admin', 'customer_user'");
  });

  it('defers source linkage to internal execution tables (commented only)', () => {
    const migration = readMigration();

    expect(migration).toContain('source_customer_deposit_request_id');
    expect(migration).toContain('source_customer_withdrawal_request_id');
    expect(migration).toContain('-- alter table public.tgd_receiving_documents');
    expect(migration).toContain('tgd_customer_deposit_receiving_links');
    expect(migration).not.toMatch(/^alter table public\.tgd_receiving_documents/m);
  });

  it('does not contain destructive statements or stock movement RPC changes', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/drop\s+table/);
    expect(migration).not.toMatch(/truncate\s+table/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/reset\s+/);
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
    expect(migration).not.toContain('tgd_post_dispatch_document');
    expect(migration).not.toContain('service_role');
  });

  it('documents draft-only apply guard in header comment', () => {
    const migration = readMigration();

    expect(migration).toContain('DRAFT ONLY');
    expect(migration).toContain('do NOT apply');
  });
});
