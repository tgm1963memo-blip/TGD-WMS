import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261105090000_withdrawal_confirmed_dispatch_date.sql', 'utf8');

function functionBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
}

describe('20261105090000 withdrawal confirmed dispatch date', () => {
  it('adds the confirmed-date columns beside requested_dispatch_date', () => {
    for (const col of ['confirmed_dispatch_date date', 'confirmed_dispatch_by_email text', 'confirmed_dispatch_at timestamptz']) {
      expect(sql).toContain(`add column if not exists ${col}`);
    }
  });

  it('keeps the review RPC signature, defaults the date at ACCEPT before the accepted email is queued', () => {
    const body = functionBody('tgd_review_customer_withdrawal_request');
    expect(body).toMatch(/p_effective_date\s+date default null\s*\)/);
    const defaulting = body.indexOf('set confirmed_dispatch_date     = requested_dispatch_date');
    const email = body.indexOf("'WITHDRAWAL_ACCEPTED'");
    expect(defaulting).toBeGreaterThan(0);
    expect(defaulting).toBeLessThan(email);
    expect(body).toContain('and confirmed_dispatch_date is null');
    // Still the latest backdate-aware body (20261020100000).
    expect(body).toContain("v_profile.role is distinct from 'admin'");
  });

  it('guards the setter by approve role and status, and notifies only after acceptance', () => {
    const body = functionBody('tgd_set_withdrawal_confirmed_dispatch_date');
    expect(body).toContain("'customer_request_approve'");
    expect(body).toContain("in ('SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING')");
    expect(body).toContain("if v_document.status in ('ADMIN_ACCEPTED', 'WAREHOUSE_PICKING') then");
    expect(body).toContain("'WITHDRAWAL_DATE_CONFIRMED'");
    expect(sql).toContain('grant execute on function public.tgd_set_withdrawal_confirmed_dispatch_date(uuid, date, text) to authenticated;');
  });

  it('puts the confirmed date in the customer emails', () => {
    const body = functionBody('tgd_enqueue_customer_request_notifications');
    expect(body).toContain("p_notification_event in ('WITHDRAWAL_ACCEPTED', 'WITHDRAWAL_DATE_CONFIRMED')");
    expect(body).toContain('วันส่งสินค้าที่ยืนยัน');
    // The customer's opt-out (20260818130000) still gates both emails.
    expect(body).toContain('v_notify_withdrawal_completed');
  });

  it('counts customer cancel lead time from the confirmed date when set', () => {
    const body = functionBody('tgd_cancel_customer_withdrawal_request');
    expect(body).toContain('coalesce(w.confirmed_dispatch_date, w.requested_dispatch_date) as requested_dispatch_date');
  });
});
