import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('effective pallet picks (line-level withdrawals count against pallets)', () => {
  it('view adds unattributed line-level picks, matched by source line or tracking code', () => {
    const sql = read('database/migrations/117_deposit_line_location_effective_picks.sql');
    expect(sql).toContain('create or replace view public.tgd_deposit_line_location_picked');
    expect(sql).toContain('security_invoker = true');
    expect(sql).toContain('source_customer_deposit_request_line_id');
    expect(sql).toContain('d.tracking_code = w.tracking_code');
    expect(sql).toContain("not in ('CANCELLED', 'REJECTED', 'DRAFT')");
    expect(read('supabase/migrations/20260925100000_deposit_line_location_effective_picks.sql')).toBe(sql);
  });

  it('occupancy reads the view instead of raw pallet picks', () => {
    const src = read('src/services/warehouseLayoutService.js');
    expect(src).toContain("from('tgd_deposit_line_location_picked')");
  });
});
