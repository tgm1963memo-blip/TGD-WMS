import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('FR + FF shared daily tracking-code sequence', () => {
  const sql = read('database/migrations/119_tracking_code_shared_fr_ff_sequence.sql');

  it('groups FR and FF into one counter and one lock', () => {
    expect(sql).toContain("when v_prefix in ('FR', 'FF') then 'FR|FF'");
    expect(sql).toContain("'^(' || v_group || ')' || v_day_key || '[0-9]+$'");
    expect(sql).toContain("replace(v_group, '|', '')");
  });

  it('keeps prefixes and format, and never rewrites existing codes', () => {
    expect(sql).toContain("when 'FREEZE_FROZEN' then 'FF'");
    expect(sql).toContain("lpad(v_seq::text, 3, '0')");
    expect(sql).not.toMatch(/update\s+public\.tgd_customer_deposit_request_lines/i);
    expect(read('supabase/migrations/20260925120000_tracking_code_shared_fr_ff_sequence.sql')).toBe(sql);
  });
});
