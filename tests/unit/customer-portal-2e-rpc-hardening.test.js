import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/043_tgd_wms_customer_portal_rpc_hardening.sql',
);
const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2E_RPC_HARDENING.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2E RPC hardening draft', () => {
  it('creates migration 043 and the hardening document', () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(docPath)).toBe(true);
  });

  it('defines all required transition RPCs', () => {
    const migration = readMigration();
    const names = [
      'tgd_submit_customer_deposit_request',
      'tgd_review_customer_deposit_request',
      'tgd_cancel_customer_deposit_request',
      'tgd_submit_customer_withdrawal_request',
      'tgd_review_customer_withdrawal_request',
      'tgd_cancel_customer_withdrawal_request',
    ];

    names.forEach((name) => {
      expect(migration).toContain(`function public.${name}`);
    });
  });

  it('checks the required status transitions and decisions', () => {
    const migration = readMigration();

    expect(migration).toContain("v_document.status <> 'DRAFT'");
    expect(migration).toContain("v_document.status <> 'WITHDRAWAL_DRAFT'");
    expect(migration).toContain("v_document.status = 'SUBMITTED_BY_CUSTOMER'");
    expect(migration).toContain("v_document.status = 'ADMIN_REVIEWING'");
    expect(migration).toContain("v_to_status := 'ADMIN_ACCEPTED'");
    expect(migration).toContain("v_to_status := 'ADMIN_REJECTED'");
    expect(migration).toContain("v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING')");
  });

  it('blocks admin and accounting cancellation from all terminal statuses', () => {
    const migration = readMigration();

    expect(migration).toMatch(
      /v_document\.status in \(\s*'ADMIN_REJECTED',\s*'RECEIVED_CONFIRMED',\s*'CUSTOMER_NOTIFIED',\s*'CLOSED',\s*'CANCELLED'\s*\)/,
    );
    expect(migration).toMatch(
      /v_document\.status in \(\s*'ADMIN_REJECTED',\s*'LOADED_CONFIRMED',\s*'CUSTOMER_NOTIFIED',\s*'CLOSED',\s*'CANCELLED'\s*\)/,
    );
    expect(migration).toContain(
      "v_document.status not in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')",
    );
    expect(migration).toContain(
      "v_document.status not in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER')",
    );
  });

  it('checks active profiles, roles, and customer scope', () => {
    const migration = readMigration();

    expect(migration).toContain('public.tgd_current_user_is_active()');
    expect(migration).toContain("'customer_admin', 'customer_user'");
    expect(migration).toContain("'admin', 'accounting'");
    expect(migration).toContain('v_profile.customer_id <> v_document.customer_id');
    expect(migration).toContain('v_profile.customer_id is null');
  });

  it('locks each target row and writes timeline events', () => {
    const migration = readMigration().toLowerCase();

    expect((migration.match(/for update;/g) ?? [])).toHaveLength(6);
    expect((migration.match(/insert into public\.tgd_customer_document_timeline_events/g) ?? []))
      .toHaveLength(6);
    expect(migration).toContain('from_status');
    expect(migration).toContain('to_status');
    expect(migration).toContain('actor_user_id');
  });

  it('sets a safe search path for every security definer function', () => {
    const migration = readMigration().toLowerCase();

    expect((migration.match(/security definer/g) ?? [])).toHaveLength(6);
    expect((migration.match(/set search_path = public/g) ?? [])).toHaveLength(6);
  });

  it('hardens direct transition and timeline writes while documenting draft exposure', () => {
    const migration = readMigration().toLowerCase();
    const doc = readFileSync(docPath, 'utf8');

    expect(migration).toContain(
      'revoke update on public.tgd_customer_deposit_requests from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke update on public.tgd_customer_withdrawal_requests from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert on public.tgd_customer_document_timeline_events from anon, authenticated',
    );
    expect(doc).toContain('Transition-RPC only now');
    expect(doc).toContain('draft creation');
    expect(doc).toMatch(/line\s+mutation RPC contracts/);
  });

  it('contains no warehouse execution, destructive table operation, privileged client role, or live-environment reference', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toContain('tgd_stock_movements');
    expect(migration).not.toContain('tgd_stock_balances');
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
    expect(migration).not.toContain('tgd_post_dispatch_document');
    expect(migration).not.toContain('tgd_confirm_picking_document');
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/reset\s+/);
    expect(migration).not.toMatch(/drop\s+table/);
    expect(migration).not.toContain('service_role');
    expect(migration).not.toContain('production');
  });
});
