import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/044_tgd_wms_customer_portal_create_edit_rpc.sql',
);
const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2E2_CREATE_EDIT_RPC.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2E-2 create/edit RPC hardening draft', () => {
  it('creates migration 044 and the 2E-2 document', () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(docPath)).toBe(true);
  });

  it('defines all required create/edit RPCs', () => {
    const migration = readMigration();
    const names = [
      'tgd_create_customer_deposit_request',
      'tgd_update_customer_deposit_request_draft',
      'tgd_upsert_customer_deposit_request_line',
      'tgd_create_customer_withdrawal_request',
      'tgd_update_customer_withdrawal_request_draft',
      'tgd_upsert_customer_withdrawal_request_line',
    ];

    names.forEach((name) => {
      expect(migration).toContain(`function public.${name}`);
    });
  });

  it('includes optional narrow draft line delete RPCs', () => {
    const migration = readMigration();

    expect(migration).toContain('function public.tgd_delete_customer_deposit_request_line');
    expect(migration).toContain('function public.tgd_delete_customer_withdrawal_request_line');
  });

  it('checks active profile validation', () => {
    const migration = readMigration();

    expect(migration).toContain('public.tgd_current_user_is_active()');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('p.is_active = true');
  });

  it('checks customer role and customer_id requirements', () => {
    const migration = readMigration();

    expect(migration).toContain("'customer_admin', 'customer_user'");
    expect(migration).toContain('v_profile.customer_id is null');
    expect(migration).toContain('Customer profile must be linked to a customer_id');
  });

  it('checks customer scope and draft status guards', () => {
    const migration = readMigration();

    expect(migration).toContain('v_profile.customer_id <> v_document.customer_id');
    expect(migration).toContain("v_document.status <> 'DRAFT'");
    expect(migration).toContain("v_document.status <> 'WITHDRAWAL_DRAFT'");
    expect(migration).toContain("'DRAFT'");
    expect(migration).toContain("'WITHDRAWAL_DRAFT'");
  });

  it('validates withdrawal picking_rule choices', () => {
    const migration = readMigration();

    expect(migration).toContain("'FEFO', 'SPECIFIC_DEPOSIT', 'SPECIFIC_LOT'");
    expect(migration).toContain(
      'picking_rule must be FEFO, SPECIFIC_DEPOSIT, or SPECIFIC_LOT',
    );
  });

  it('locks parent rows and writes timeline events for mutation flows', () => {
    const migration = readMigration().toLowerCase();

    expect((migration.match(/for update;/g) ?? [])).toHaveLength(6);
    expect(
      (migration.match(/insert into public\.tgd_customer_document_timeline_events/g) ?? []),
    ).toHaveLength(8);
    expect(migration).toContain('create_draft');
    expect(migration).toContain('update_draft');
    expect(migration).toContain('insert_line');
    expect(migration).toContain('update_line');
    expect(migration).toContain('delete_line');
  });

  it('sets a safe search path for every security definer function', () => {
    const migration = readMigration().toLowerCase();

    expect(
      (migration.match(/language plpgsql\s+security definer\s+set search_path = public/g) ?? []),
    ).toHaveLength(8);
  });

  it('revokes direct header and line writes after RPC coverage', () => {
    const migration = readMigration().toLowerCase();
    const doc = readDoc().toLowerCase();

    expect(migration).toContain(
      'revoke insert on public.tgd_customer_deposit_requests from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert on public.tgd_customer_withdrawal_requests from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert on public.tgd_customer_deposit_request_lines from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke update on public.tgd_customer_deposit_request_lines from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert on public.tgd_customer_withdrawal_request_lines from anon, authenticated',
    );
    expect(doc).toContain('direct-write revoke plan');
    expect(doc).toContain('attachment metadata insert');
  });

  it('contains no stock movement, execution, storage bucket, or privileged client references', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toContain('tgd_stock_movements');
    expect(migration).not.toContain('tgd_stock_balances');
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
    expect(migration).not.toContain('tgd_post_dispatch_document');
    expect(migration).not.toContain('tgd_confirm_picking_document');
    expect(migration).not.toContain('storage.buckets');
    expect(migration).not.toContain('service_role');
    expect(migration).not.toContain('production');
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/drop\s+table/);
    expect(migration).not.toMatch(/reset\s+/);
  });

  it('documents and limits destructive SQL to narrow draft line delete only', () => {
    const migration = readMigration().toLowerCase();
    const doc = readDoc().toLowerCase();

    expect((migration.match(/delete from public\.tgd_customer_deposit_request_lines/g) ?? []))
      .toHaveLength(1);
    expect((migration.match(/delete from public\.tgd_customer_withdrawal_request_lines/g) ?? []))
      .toHaveLength(1);
    expect(migration).toContain('deposit_request_id = v_document.id');
    expect(migration).toContain('withdrawal_request_id = v_document.id');
    expect(doc).toContain('narrow line delete approval');
  });
});
