import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A live-data audit found 45 real withdrawal requests already COMPLETED
// with picked_boxes AND picked_weight both still null on some or all
// lines — tgd_review_customer_withdrawal_request's CONFIRM_DISPATCH
// branch never checked the lines at all, and the desktop admin review
// page (unlike the handheld picking page) had no client-side guard
// either. The deposit side (CONFIRM_RECEIPT) was only ever guarded
// client-side, never server-side, so a direct RPC call could always
// bypass it too. Structural checks only — both functions require a real
// auth.uid() session to invoke.

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260810090000_require_confirmed_qty_before_completing_documents.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('20260810090000 require confirmed qty before completing documents', () => {
  it('creates the migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('replaces both review RPCs in place (same signatures)', () => {
    const sql = readMigration();
    expect(sql).toContain('create or replace function public.tgd_review_customer_deposit_request(');
    expect(sql).toContain('create or replace function public.tgd_review_customer_withdrawal_request(');
  });

  it('blocks CONFIRM_RECEIPT when any deposit line has neither actual_boxes nor actual_weight', () => {
    const sql = readMigration();
    expect(sql).toContain('where l.deposit_request_id = p_request_id\n      and l.actual_boxes is null\n      and l.actual_weight is null;');
    expect(sql).toContain('Cannot confirm receipt: % line(s) have no confirmed quantity');
  });

  it('blocks CONFIRM_DISPATCH when any withdrawal line has neither picked_boxes nor picked_weight', () => {
    const sql = readMigration();
    expect(sql).toContain('where wl.withdrawal_request_id = v_document.id\n      and wl.picked_boxes is null\n      and wl.picked_weight is null;');
    expect(sql).toContain('Cannot confirm dispatch: % line(s) have no confirmed pick quantity');
  });

  it('still preserves every pre-existing transition and permission check', () => {
    const sql = readMigration();
    // Deposit: every original decision + transition kept.
    expect(sql).toContain("if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT', 'COUNT_VARIANCE') then");
    expect(sql).toContain('perform public.tgd_create_stock_movements_from_deposit(v_document.id, v_profile.id);');
    // Withdrawal: every original decision + transition kept.
    expect(sql).toContain("if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'SEND_TO_PICKING', 'CONFIRM_DISPATCH') then");
    expect(sql).toContain('perform public.tgd_sync_stock_balances_for_withdrawal(v_document.id);');
  });
});
