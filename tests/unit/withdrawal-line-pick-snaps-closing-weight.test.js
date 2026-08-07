import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// tgd_record_withdrawal_line_pick already computed the exact pre-pick
// remaining balance server-side (v_max_boxes/v_max_weight minus every
// OTHER non-cancelled line's claim) to validate a pick doesn't overdraw
// the deposit line — this migration reuses those same variables to snap
// a genuinely CLOSING pick's picked_weight to the true remaining weight
// balance, instead of leaving whatever the independent scale reading
// drifted to. Structural checks only (the function requires a real
// auth.uid() session to invoke, which a migration/test script doesn't
// have) — the arithmetic itself mirrors the pre-existing, already-tested
// validation logic in the same function one migration prior.

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260807090000_snap_closing_pick_weight_to_remaining_balance.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('20260807090000 snap closing pick weight to remaining balance', () => {
  it('creates the migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('replaces tgd_record_withdrawal_line_pick in place (same signature)', () => {
    const sql = readMigration();
    expect(sql).toContain('create or replace function public.tgd_record_withdrawal_line_pick(');
    expect(sql).toContain('p_line_id      uuid,');
    expect(sql).toContain('p_picked_boxes numeric default null,');
    expect(sql).toContain('p_picked_weight numeric default null');
  });

  it('only snaps when this pick exactly exhausts a genuinely nonzero remaining balance', () => {
    const sql = readMigration();
    expect(sql).toContain('v_remaining_boxes := v_max_boxes - v_claimed_boxes;');
    expect(sql).toContain('if v_max_boxes > 0 and v_remaining_boxes > 0 and p_picked_boxes = v_remaining_boxes then');
  });

  it('snaps to the true remaining weight balance, floored at 0', () => {
    const sql = readMigration();
    expect(sql).toContain('v_final_picked_weight := greatest(0, v_max_weight - v_claimed_weight);');
  });

  it('writes the snapped weight, not the raw input, and returns it in the response', () => {
    const sql = readMigration();
    expect(sql).toContain('picked_weight    = v_final_picked_weight,');
    expect(sql).toContain("'picked_weight', v_final_picked_weight");
  });

  it('still preserves the pre-existing over-claim validation for both boxes and weight', () => {
    const sql = readMigration();
    expect(sql).toContain('Picked boxes (%) exceed remaining balance (%) for this deposit line/tracking code');
    expect(sql).toContain('Picked weight (%) exceeds remaining balance (%) for this deposit line/tracking code');
  });

  it('leaves a normal partial pick (not closing the lot) using the operator/scale-entered weight untouched', () => {
    const sql = readMigration();
    // v_final_picked_weight is initialized straight from the raw input and
    // only reassigned inside the closing-pick branch above.
    expect(sql).toContain('v_final_picked_weight numeric := p_picked_weight;');
  });
});
