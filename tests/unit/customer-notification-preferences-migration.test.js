import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260818130000_customer_notification_preferences.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

// Regression coverage for Part J: per-customer email notification
// preferences, plus the fixes needed for DEPOSIT_CONFIRMED/
// DISPATCH_CONFIRMED/INVOICE_APPROVED to actually fire correctly.
describe('customer notification preferences migration', () => {
  it('exists and never drops/truncates/deletes the customer or email-queue tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('adds the 3 new preference columns defaulting to true, preserving today\'s always-send behavior', () => {
    const sql = readMigration();
    expect(sql).toMatch(/notify_deposit_confirmed boolean not null default true/);
    expect(sql).toMatch(/notify_withdrawal_completed boolean not null default true/);
    expect(sql).toMatch(/notify_invoice_approved boolean not null default true/);
  });

  it('backfills email from contact_email without ever overwriting an existing email value', () => {
    const sql = readMigration();
    const backfillMatch = sql.match(/update public\.tgd_customers[\s\S]*?where([\s\S]*?);/);
    expect(backfillMatch).not.toBeNull();
    expect(backfillMatch[1]).toContain("nullif(btrim(email), '') is null");
  });

  it('reads c.email (not c.contact_email) for the notification recipient address', () => {
    const sql = readMigration();
    expect(sql).toContain('nullif(btrim(c.email), \'\')');
    expect(sql).not.toContain('c.contact_email');
  });

  it('adds DISPATCH_CONFIRMED and INVOICE_APPROVED branches, each gated by the matching preference', () => {
    const sql = readMigration();
    expect(sql).toContain("p_notification_event = 'DISPATCH_CONFIRMED'");
    expect(sql).toMatch(/DISPATCH_CONFIRMED[\s\S]*?v_notify_withdrawal_completed/);
    expect(sql).toContain("p_notification_event = 'INVOICE_APPROVED'");
    expect(sql).toMatch(/INVOICE_APPROVED[\s\S]*?v_notify_invoice_approved/);
  });

  it('gates DEPOSIT_CONFIRMED by v_notify_deposit_confirmed', () => {
    const sql = readMigration();
    expect(sql).toMatch(/DEPOSIT_CONFIRMED[\s\S]*?v_notify_deposit_confirmed/);
  });

  it('does not gate the internal OPERATIONS_ALERT staff emails by any customer preference', () => {
    const sql = readMigration();
    const alertBlockMatch = sql.match(/'OPERATIONS_ALERT'/);
    expect(alertBlockMatch).not.toBeNull();
    // The OPERATIONS_ALERT insert lives inside the final "else" branch, which
    // has no v_notify_* condition guarding it — only v_customer_email is not
    // null is checked earlier for the customer-facing rows in that branch.
    const elseBranch = sql.slice(sql.indexOf('-- CUSTOMER_SUBMIT'));
    expect(elseBranch).not.toMatch(/v_notify_deposit_confirmed|v_notify_withdrawal_completed|v_notify_invoice_approved/);
  });
});
