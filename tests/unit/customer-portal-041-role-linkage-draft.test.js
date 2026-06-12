import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/041_tgd_wms_customer_portal_roles_and_source_links.sql',
);
const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2C_041_ROLE_LINKAGE_REVIEW.md');

const PRESERVED_ROLES = [
  'admin',
  'warehouse_manager',
  'warehouse_staff',
  'accounting',
  'viewer',
];

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2C-041 role and source linkage migration draft', () => {
  it('creates migration 041 draft file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('preserves existing internal roles and adds customer portal roles', () => {
    const migration = readMigration();

    expect(migration).toContain('tgd_user_profiles_role_check');
    PRESERVED_ROLES.forEach((role) => {
      expect(migration).toContain(`'${role}'`);
    });
    expect(migration).toContain("'customer_admin'");
    expect(migration).toContain("'customer_user'");
    expect(migration).not.toMatch(/update\s+public\.tgd_user_profiles/i);
    expect(migration).not.toMatch(/set\s+role\s*=/i);
  });

  it('adds source linkage on inspected execution table names', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('tgd_receiving_documents');
    expect(migration).toContain('source_customer_deposit_request_id');
    expect(migration).toContain('source_customer_deposit_request_no');
    expect(migration).toContain('tgd_withdrawal_requests');
    expect(migration).toContain('source_customer_withdrawal_request_id');
    expect(migration).toContain('source_customer_withdrawal_no');
    expect(migration).not.toMatch(/alter table[^\n]*tgd_receiving_headers/i);
    expect(migration).not.toMatch(/alter table[^\n]*tgd_withdrawal_request_headers/i);
  });

  it('drafts line-level link tables for partial execution', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('tgd_customer_deposit_receiving_links');
    expect(migration).toContain('tgd_customer_withdrawal_execution_links');
    expect(migration).toContain('tgd_picking_documents');
    expect(migration).toContain('tgd_dispatch_documents');
  });

  it('extends attachment statuses with PENDING and FAILED', () => {
    const migration = readMigration();

    expect(migration).toContain("'PENDING'");
    expect(migration).toContain("'FAILED'");
    expect(migration).toContain('tgd_customer_document_attachments_status_check');
  });

  it('does not contain destructive statements or forbidden logic', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).not.toMatch(/drop\s+table/);
    expect(migration).not.toMatch(/truncate\s+table/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/reset\s+/);
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
    expect(migration).not.toContain('tgd_post_dispatch_document');
    expect(migration).not.toContain('service_role');
    expect(migration).not.toContain('export-bplus');
  });

  it('documents draft-only scope and prerequisite 040', () => {
    const migration = readMigration();

    expect(migration).toContain('DRAFT ONLY');
    expect(migration).toContain('Prerequisite: migration 040');
    expect(migration).not.toMatch(/update\s+public\.tgd_user_profiles/i);
  });

  it('creates review documentation with required sections', () => {
    const doc = readFileSync(docPath, 'utf8');

    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('Why 041 is needed before Gate 2D');
    expect(doc).toContain('Role constraint change');
    expect(doc).toContain('tgd_receiving_documents');
    expect(doc).toContain('tgd_withdrawal_requests');
    expect(doc).toContain('RLS implications');
    expect(doc).toContain('UAT profile linkage');
    expect(doc).toContain('Rollback');
    expect(doc).toContain('PENDING');
    expect(doc).toContain('FAILED');
  });
});
