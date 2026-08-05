import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guardMigrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260804160000_deposit_line_edit_guard_and_audit_log.sql',
);
const overloadCleanupPath = path.join(
  process.cwd(),
  'supabase/migrations/20260804161000_drop_obsolete_deposit_line_receipt_overloads.sql',
);

function readSql(p) {
  return readFileSync(p, 'utf8');
}

// Regression coverage for a real reported gap: tgd_record_deposit_line_
// actual_receipt could reduce a deposit line's actual_boxes/actual_weight
// below what's already been withdrawn from that exact lot (no check, no
// status guard, no audit trail at all) — a retroactive correction could
// silently understate real stock. Fixed by summing non-cancelled
// withdrawal claims against the line (same direct-id-then-tracking-code
// attribution as getDepositInventoryLines) and blocking + logging.
describe('tgd_record_deposit_line_actual_receipt: withdrawn-amount guard + audit log', () => {
  it('exists and is additive only', () => {
    expect(existsSync(guardMigrationPath)).toBe(true);
    const sql = readSql(guardMigrationPath);
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('sums non-cancelled withdrawal claims the same way getDepositInventoryLines attributes them (direct id, else tracking_code)', () => {
    const sql = readSql(guardMigrationPath);
    expect(sql).toContain("wr.status <> 'CANCELLED'");
    expect(sql).toContain('wl.source_customer_deposit_request_line_id = p_line_id');
    expect(sql).toContain('wl.tracking_code = v_line.tracking_code');
    expect(sql).toContain('coalesce(wl.picked_boxes, wl.requested_boxes, 0)');
    expect(sql).toContain('coalesce(wl.picked_weight, wl.requested_weight, 0)');
  });

  it('raises an exception when the new value would drop below the withdrawn amount, for both boxes and weight', () => {
    const sql = readSql(guardMigrationPath);
    expect(sql).toMatch(/v_new_boxes\s+<\s+v_withdrawn_boxes/);
    expect(sql).toMatch(/v_new_weight\s+<\s+v_withdrawn_weight/);
    expect(sql).toContain('raise exception');
  });

  it('logs every call to the customer document timeline, including before/after quantities', () => {
    const sql = readSql(guardMigrationPath);
    expect(sql).toContain('insert into public.tgd_customer_document_timeline_events');
    expect(sql).toContain("'EDIT_LINE_ACTUAL_RECEIPT'");
    expect(sql).toContain("'actual_boxes_before', v_line.actual_boxes, 'actual_boxes_after', v_new_boxes");
    expect(sql).toContain("'actual_weight_before', v_line.actual_weight, 'actual_weight_after', v_new_weight");
  });

  it('drops the obsolete overloaded signatures discovered while testing, so only the guarded version is callable', () => {
    expect(existsSync(overloadCleanupPath)).toBe(true);
    const sql = readSql(overloadCleanupPath);
    expect(sql).toContain('drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text);');
    expect(sql).toContain('drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, numeric, numeric, text);');
  });
});
