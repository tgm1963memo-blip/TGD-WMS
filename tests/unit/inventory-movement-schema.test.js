import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/002_inventory_movement_engine.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');

describe('Sprint 1B inventory movement schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');

  it('creates the inventory movement engine migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates inventory movement and stock balance tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_inventory_movements');
    expect(migrationSql).toContain('create table if not exists tgd_stock_balances');
  });

  it('constrains all supported movement types', () => {
    [
      'OPENING_BALANCE',
      'RECEIVE',
      'PUTAWAY',
      'TRANSFER',
      'ADJUST_IN',
      'ADJUST_OUT',
      'PICK_ALLOCATE',
      'PICK_CONFIRM',
      'RETURN_IN',
      'REVERSE',
    ].forEach((movementType) => {
      expect(migrationSql).toContain(`'${movementType}'`);
    });

    expect(migrationSql).toContain('constraint tgd_inventory_movements_type_check check');
  });

  it('adds quantity and non-negative stock constraints', () => {
    expect(migrationSql).toContain('constraint tgd_inventory_movements_qty_positive check (qty > 0)');
    expect(migrationSql).toContain('constraint tgd_stock_balances_qty_on_hand_nonnegative check (qty_on_hand >= 0)');
    expect(migrationSql).toContain('constraint tgd_stock_balances_qty_allocated_nonnegative check (qty_allocated >= 0)');
    expect(migrationSql).toContain('constraint tgd_stock_balances_allocated_lte_on_hand check (qty_allocated <= qty_on_hand)');
  });

  it('uses a nullable-safe stock balance identity strategy', () => {
    expect(migrationSql).toContain('create unique index if not exists tgd_stock_balances_identity_unique_idx');
    expect(migrationSql).toContain("coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)");
    expect(migrationSql).toContain("coalesce(pallet_id, '00000000-0000-0000-0000-000000000000'::uuid)");
  });

  it('creates the posting function and stock write guard', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_inventory_movement(input jsonb)');
    expect(migrationSql).toContain('insert into tgd_inventory_movements');
    expect(migrationSql).toContain('create trigger guard_tgd_stock_balances_write');
    expect(migrationSql).toContain('stock balances may only be changed by tgd_post_inventory_movement');
  });

  it('does not create document workflow tables in Sprint 1B', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_receiving/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_picking/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_transfer/i);
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
  });
});

