import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/040_tgd_wms_customer_portal_source_documents.sql',
);
const reviewDocPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2C_MIGRATION_REVIEW.md');

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2C migration 040 review', () => {
  it('creates the 2C review document', () => {
    expect(existsSync(reviewDocPath)).toBe(true);
  });

  it('revokes DELETE on all customer portal tables', () => {
    const migration = readMigration().toLowerCase();

    expect(migration).toContain('revoke delete on public.tgd_customer_deposit_requests');
    expect(migration).toContain('revoke delete on public.tgd_customer_document_timeline_events');
  });

  it('restricts timeline insert policy beyond is_active only', () => {
    const migration = readMigration();

    expect(migration).toContain('rls_customer_document_timeline_events_insert');
    expect(migration).toMatch(
      /rls_customer_document_timeline_events_insert[\s\S]*tgd_current_user_role\(\)/,
    );
    expect(migration).toMatch(
      /rls_customer_document_timeline_events_insert[\s\S]*tgd_current_user_customer_id\(\)/,
    );
  });

  it('documents Option B role constraint strategy in review doc', () => {
    const doc = readFileSync(reviewDocPath, 'utf8');

    expect(doc).toContain('Option B');
    expect(doc).toContain('customer_admin');
    expect(doc).toContain('041');
    expect(doc).toContain('RECEIVING_VARIANCE');
    expect(doc).toContain('Hybrid');
  });

  it('review doc states FIX REQUIRED before 2D apply', () => {
    const doc = readFileSync(reviewDocPath, 'utf8');

    expect(doc).toContain('FIX REQUIRED');
    expect(doc).toContain('Gate 2D');
  });
});
