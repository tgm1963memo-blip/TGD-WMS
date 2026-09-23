import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260922090000_skip_admin_role_request_emails.sql',
);
const databaseMigrationPath = path.join(
  process.cwd(),
  'database/migrations/113_skip_admin_role_request_emails.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('customer request emails: admin role exclusion', () => {
  it('exists and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(databaseMigrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
  });

  it('marks existing pending admin-role emails as skipped', () => {
    const sql = readMigration();
    expect(sql).toMatch(/update\s+public\.tgd_customer_request_email_queue/i);
    expect(sql).toMatch(/status\s*=\s*'SKIPPED'/i);
    expect(sql).toMatch(/lower\(btrim\(coalesce\(recipient_role,\s*''\)\)\)\s*=\s*'admin'/i);
  });

  it('adds a queue trigger so future admin-role emails are skipped before sending', () => {
    const sql = readMigration();
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.tgd_skip_admin_request_email_queue/i);
    expect(sql).toMatch(/create\s+trigger\s+tgd_skip_admin_request_email_queue_trg/i);
    expect(sql).toMatch(/before\s+insert\s+or\s+update\s+of\s+recipient_role,\s+status/i);
  });

  it('keeps warehouse_admin eligible while excluding only the admin role', () => {
    const sql = readMigration();
    expect(sql).toContain("'admin'");
    expect(sql).not.toMatch(/warehouse_admin[^']*'SKIPPED'/i);
  });
});
