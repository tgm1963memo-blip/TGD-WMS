import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260804170000_exclude_accounting_warehouse_manager_from_request_emails.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

// Regression coverage: tgd_enqueue_customer_request_notifications' internal
// staff alert (deposit/withdrawal submitted/recount-requested/dispatch-
// confirmed) used to go to every active admin, accounting, warehouse_admin,
// and warehouse_manager user. Per request, warehouse_manager and accounting
// should stop receiving these.
describe('tgd_enqueue_customer_request_notifications: staff alert role list', () => {
  it('exists and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('scopes the internal staff alert to admin and warehouse_admin only', () => {
    const sql = readMigration();
    const roleFilterMatch = sql.match(/p\.role in \(([^)]+)\)/);
    expect(roleFilterMatch).not.toBeNull();
    expect(roleFilterMatch[1]).toBe("'admin', 'warehouse_admin'");
  });

  it('leaves the customer-facing confirmation branches (DEPOSIT_CONFIRMED/WITHDRAWAL_ACCEPTED) untouched', () => {
    const sql = readMigration();
    expect(sql).toContain("p_notification_event = 'DEPOSIT_CONFIRMED'");
    expect(sql).toContain("p_notification_event = 'WITHDRAWAL_ACCEPTED'");
    expect(sql).toContain("'customer_primary'");
  });
});
