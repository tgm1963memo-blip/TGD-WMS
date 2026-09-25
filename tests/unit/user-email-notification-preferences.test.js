import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('user email notification preferences', () => {
  const sql = read('database/migrations/120_user_email_notification_preferences.sql');

  it('queue trigger skips opted-out recipients by address', () => {
    expect(sql).toContain('function public.tgd_is_email_opted_out');
    expect(sql).toContain('receives_email_alerts, true) = false');
    expect(sql).toContain('public.tgd_is_email_opted_out(new.recipient_email)');
    expect(read('supabase/migrations/20260925130000_user_email_notification_preferences.sql')).toBe(sql);
  });

  it('users set their own switch; only admins set other users', () => {
    expect(sql).toContain('function public.tgd_set_my_email_notifications');
    expect(sql).toContain('where auth_user_id = auth.uid()');
    expect(sql).toContain('function public.tgd_admin_set_user_email_notifications');
    expect(sql).toContain("public.tgd_current_user_role() <> 'admin'");
  });

  it('profile page and user management page expose the switch', () => {
    const profile = read('src/features/settings/ProfileSettingsPage.jsx');
    expect(profile).toContain('setMyEmailNotifications');
    expect(profile).toContain('profile-email-notifications-toggle');
    const users = read('src/features/admin/UserManagementPage.jsx');
    expect(users).toContain('adminSetUserEmailNotifications');
    expect(users).toContain('user-mgmt-email-toggle');
    const svc = read('src/services/userProfileService.js');
    expect(svc).toContain("rpc('tgd_set_my_email_notifications'");
    expect(svc).toContain("rpc('tgd_admin_set_user_email_notifications'");
    expect(svc).toContain('receives_email_alerts');
  });

  it('email sender also skips opted-out recipients', () => {
    const api = read('api/process-email-queue.js');
    expect(api).toContain(".eq('receives_email_alerts', false)");
    expect(api).toContain('optedOutEmails.has(recipientEmail)');
  });
});
