import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const apiPath = path.join(process.cwd(), 'api/process-email-queue.js');

describe('process-email-queue admin role guard', () => {
  it('skips queued admin-role messages before sending mail', () => {
    const source = readFileSync(apiPath, 'utf8');
    const guardIndex = source.indexOf("recipient_role || '').trim().toLowerCase() === 'admin'");
    const sendIndex = source.indexOf('await transporter.sendMail');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(sendIndex);
    expect(source).toContain("status: 'SKIPPED'");
    expect(source).toContain('skippedCount');
  });
});

describe('process-email-queue admin address guard', () => {
  it('also skips rows addressed to an active admin under another role label', () => {
    const source = readFileSync(apiPath, 'utf8');
    expect(source).toContain(".eq('role', 'admin')");
    expect(source).toContain('adminEmails.has(');
    expect(source.indexOf('adminEmails.has(')).toBeLessThan(source.indexOf('await transporter.sendMail'));
  });
});

describe('migration 118 admin email block', () => {
  const sql = readFileSync(path.join(process.cwd(), 'database/migrations/118_block_admin_emails_by_address.sql'), 'utf8');
  it('skips by recipient address, not only role label', () => {
    expect(sql).toContain('function public.tgd_is_admin_email');
    expect(sql).toContain('public.tgd_is_admin_email(new.recipient_email)');
    expect(readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925110000_block_admin_emails_by_address.sql'), 'utf8')).toBe(sql);
  });
  it('gives RECOUNT_REQUESTED its own branch and alerts warehouse_admin only', () => {
    expect(sql).toContain("p_notification_event = 'RECOUNT_REQUESTED'");
    expect(sql).not.toContain("p.role in ('admin', 'warehouse_admin')");
    expect(sql).toContain("and p.role = 'warehouse_admin'");
  });
});
