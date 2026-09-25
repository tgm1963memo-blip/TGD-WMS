import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('reset location', () => {
  it('migration clears allocations but skips picked pallets and never touches stock balances', () => {
    const sql = read('database/migrations/116_reset_location_allocations.sql');
    expect(sql).toContain('function public.tgd_reset_location_allocations');
    expect(sql).toContain('tgd_customer_withdrawal_line_pallet_picks');
    expect(sql).toContain('p_dry_run');
    expect(sql).not.toMatch(/delete from public\.tgd_stock_balances/);
    expect(read('supabase/migrations/20260925090000_reset_location_allocations.sql')).toBe(sql);
  });

  it('service previews before resetting', () => {
    const src = read('src/services/warehouseLayoutService.js');
    expect(src).toContain("rpc('tgd_reset_location_allocations'");
    expect(src).toContain('dryRun: true');
    expect(src).toContain('window.confirm');
  });

  it('adds reset buttons to location setup (room + row) and the layout widget', () => {
    const setup = read('src/features/admin/WarehouseLocationSetupPage.jsx');
    expect(setup).toContain('section-reset-location-button');
    expect(setup).toContain('location-row-reset-button');
    expect(setup).toContain('LOCATION_RESET_ROLES');
    const widget = read('src/features/dashboard/WarehouseLayoutWidget.jsx');
    expect(widget).toContain('layout-reset-location-button');
    expect(widget).toContain('confirmAndResetLocations');
  });
});
