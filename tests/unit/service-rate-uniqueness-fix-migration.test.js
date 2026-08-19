import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260819090000_fix_service_rate_uniqueness_missing_types.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

// Regression coverage for a real bug found via E2E testing of Part G:
// tgd_upsert_product_service_rate's ON CONFLICT clauses (and the partial
// unique indexes backing them) only covered a hardcoded list of service
// types missing R3_DOCUMENT/PLUG_IN/OVERTIME — for those types, Postgres
// silently skips conflict detection and inserts a duplicate row every time,
// instead of erroring or updating. Confirmed directly: repeatedly "saving"
// the same customer+OVERTIME+all-items rate created 5 separate rows.
describe('service rate uniqueness fix migration', () => {
  it('exists and never drops/truncates/deletes data', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('both partial unique indexes now include R3_DOCUMENT, PLUG_IN, and OVERTIME', () => {
    const sql = readMigration();
    const indexBlocks = [...sql.matchAll(/create unique index tgd_product_service_rates_\w+_uidx[\s\S]*?;/g)];
    expect(indexBlocks).toHaveLength(2);
    for (const block of indexBlocks) {
      expect(block[0]).toContain("'R3_DOCUMENT'");
      expect(block[0]).toContain("'PLUG_IN'");
      expect(block[0]).toContain("'OVERTIME'");
      // The original 5 types must still be present — this is an extension,
      // not a replacement, so no existing STORAGE/HANDLING_IN/etc. rate
      // row's upsert behavior changes.
      expect(block[0]).toContain("'STORAGE'");
      expect(block[0]).toContain("'HANDLING_IN'");
      expect(block[0]).toContain("'HANDLING_OUT'");
      expect(block[0]).toContain("'LABEL'");
      expect(block[0]).toContain("'FREEZING'");
    }
  });

  it('both ON CONFLICT clauses in the upsert RPC match the new index allowlist exactly', () => {
    const sql = readMigration();
    const conflictBlocks = [...sql.matchAll(/on conflict[\s\S]*?service_type = any \(array\[[^\]]+\]\)/g)];
    expect(conflictBlocks).toHaveLength(2);
    for (const block of conflictBlocks) {
      expect(block[0]).toContain("'R3_DOCUMENT'");
      expect(block[0]).toContain("'PLUG_IN'");
      expect(block[0]).toContain("'OVERTIME'");
    }
  });

  it('preserves the full contract-terms upsert signature added in Part A (no columns dropped from the RPC)', () => {
    const sql = readMigration();
    for (const col of ['min_charge_amount', 'contract_start_date', 'contract_end_date', 'free_days', 'discount_percent', 'contract_note']) {
      expect(sql).toContain(col);
    }
  });
});
