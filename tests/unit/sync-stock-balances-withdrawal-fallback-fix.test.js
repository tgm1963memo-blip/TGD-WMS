import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// tgd_sync_stock_balances_for_withdrawal (the warehouse location-occupancy
// sync run at CONFIRM_DISPATCH) used COALESCE(picked_boxes, 0) — a
// withdrawal line with no picked_boxes recorded contributed a ZERO
// deduction to tgd_stock_balances, unlike every other balance computation
// in this codebase, which treats a null picked_boxes as the line's own
// requested_boxes (tgd_get_customer_stock_balance, getAuthoritativeBalance
// Totals, etc. all use COALESCE(picked_boxes, requested_boxes)). Found
// while backfilling 45 real withdrawal requests completed with no picked
// quantity ever recorded — this function's inconsistent fallback meant
// their location occupancy was never corrected either.

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260810100000_backfill_completed_withdrawal_picked_qty.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('20260810100000 backfill completed withdrawal picked qty', () => {
  it('creates the migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('replaces tgd_sync_stock_balances_for_withdrawal in place (same signature)', () => {
    const sql = readMigration();
    expect(sql).toContain('create or replace function public.tgd_sync_stock_balances_for_withdrawal(');
    expect(sql).toContain('p_withdrawal_request_id uuid');
  });

  it('falls back to requested_boxes (not 0) when picked_boxes is null, matching every other balance computation', () => {
    const sql = readMigration();
    expect(sql).toContain('coalesce(wl.picked_boxes, wl.requested_boxes, 0) as picked_boxes');
    expect(sql).not.toContain('coalesce(wl.picked_boxes, 0) as picked_boxes');
  });

  it('backfills only lines with neither picked_boxes nor picked_weight recorded, from their own requested amount', () => {
    const sql = readMigration();
    expect(sql).toContain('set picked_boxes    = wl.requested_boxes,');
    expect(sql).toContain('picked_weight   = wl.requested_weight,');
    expect(sql).toContain('and wl.picked_boxes is null\n      and wl.picked_weight is null;');
  });

  it('logs a timeline event per corrected document with a lines snapshot', () => {
    const sql = readMigration();
    expect(sql).toContain("'ADMIN_BACKFILL_PICKED_QTY'");
    expect(sql).toContain("jsonb_build_object('line_count', v_line_count, 'lines', v_lines_snapshot)");
  });
});
