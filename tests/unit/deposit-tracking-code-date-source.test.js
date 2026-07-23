import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260723120000_tracking_code_date_uses_expected_arrival.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('deposit tracking-code date source (expected_arrival_date, not current_date)', () => {
  it('exists and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('tgd_submit_customer_deposit_request selects expected_arrival_date and uses it as the code date', () => {
    const sql = readMigration();
    expect(sql).toContain('d.id, d.customer_id, d.status, d.request_no, d.expected_arrival_date into v_document');
    expect(sql).toContain('coalesce(v_document.expected_arrival_date, current_date)');
  });

  it('tgd_review_customer_deposit_request (ACCEPT branch) also uses expected_arrival_date, not current_date, for its fallback assignment', () => {
    const sql = readMigration();
    expect(sql).toContain('d.id, d.customer_id, d.status, d.expected_arrival_date');
    // Both generation call sites should be fixed, and neither should still
    // pass bare current_date as the code's date argument.
    const genCalls = sql.match(/tgd_generate_deposit_line_tracking_code\(\s*v_line\.temperature_type,\s*([^)]+)\)/gs) ?? [];
    expect(genCalls.length).toBe(2);
    for (const call of genCalls) {
      expect(call).toMatch(/coalesce\(v_document\.expected_arrival_date, current_date\)/);
    }
  });
});
