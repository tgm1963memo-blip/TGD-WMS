import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260723130000_admin_add_line_generates_tracking_code.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('admin-added deposit lines now generate a tracking code', () => {
  it('exists and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('generates a tracking code before inserting the new line, using the request deposit date', () => {
    const sql = readMigration();
    expect(sql).toContain('v_tracking_code := public.tgd_generate_deposit_line_tracking_code(');
    expect(sql).toContain('coalesce(v_document.expected_arrival_date, current_date)');
    expect(sql).toMatch(/insert into public\.tgd_customer_deposit_request_lines[\s\S]*?tracking_code[\s\S]*?values[\s\S]*?v_tracking_code/i);
  });

  it('backfill only targets lines created via the ADMIN_ADD_LINE timeline event, not a blanket null-tracking-code scan', () => {
    const sql = readMigration();
    expect(sql).toContain("ev.action = 'ADMIN_ADD_LINE'");
    expect(sql).toContain('dl.tracking_code is null');
  });
});
