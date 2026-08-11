import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression coverage for a real reported bug: the "เพิ่มรายการสินค้า"
// (add product item) modal's own hint text promises FEFO auto-pick when
// the tracking-code field is left blank ("เว้นว่างถ้าให้ระบบเลือกล็อตให้
// อัตโนมัติ (FEFO)"), but tgd_admin_add_customer_withdrawal_request_line
// had never actually implemented that path — its whole tracking-code
// resolution block (including the SELECT INTO v_deposit_line) only ran
// when a tracking code WAS supplied, yet the INSERT unconditionally
// referenced v_deposit_line.id, so any blank-tracking-code call crashed
// with Postgres's own `record "v_deposit_line" is not assigned yet` —
// for ANY customer/product, not anything specific to the opening-balance
// deposit line visible on screen when this was first reported.

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260810120000_fix_admin_add_withdrawal_line_fefo_crash.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('20260810120000 fix admin add withdrawal line FEFO crash', () => {
  it('creates the migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('replaces tgd_admin_add_customer_withdrawal_request_line in place (same signature)', () => {
    const sql = readMigration();
    expect(sql).toContain('create or replace function public.tgd_admin_add_customer_withdrawal_request_line(');
    expect(sql).toContain('p_customer_product_code text,');
    expect(sql).toContain('p_tracking_code text default null,');
  });

  it('never inserts v_deposit_line.id directly — uses a plain variable that defaults to null', () => {
    const sql = readMigration();
    expect(sql).toContain('v_source_line_id uuid;');
    expect(sql).toContain('v_source_line_id := v_deposit_line.id;');
    expect(sql).toContain('v_source_line_id,\n    btrim(p_customer_product_code)');
    expect(sql).not.toMatch(/values\s*\(\s*v_document\.id,\s*v_new_line_no,\s*v_deposit_line\.id/);
  });

  it('only assigns v_source_line_id inside the tracking-code-provided branch, leaving it null for FEFO', () => {
    const sql = readMigration();
    const branchStart = sql.indexOf('if v_tracking_code is not null then');
    const insertStart = sql.indexOf('insert into public.tgd_customer_withdrawal_request_lines (');
    const assignmentPos = sql.indexOf('v_source_line_id := v_deposit_line.id;');
    expect(branchStart).toBeGreaterThan(-1);
    expect(assignmentPos).toBeGreaterThan(branchStart);
    expect(assignmentPos).toBeLessThan(insertStart);
  });

  it('still sets picking_rule to FEFO when no tracking code is given', () => {
    const sql = readMigration();
    expect(sql).toContain("case when v_tracking_code is not null then 'SPECIFIC_DEPOSIT' else 'FEFO' end");
  });
});
