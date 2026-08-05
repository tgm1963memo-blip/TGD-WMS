import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260804180000_customer_product_category.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

// New feature: a free-text "product category" field on the customer
// catalog (each customer defines their own groupings, e.g. "หมู", "ไก่" —
// no fixed system-wide enum, same as argent_type/storage_charge_basis/
// allergen already are), also usable as a filter on the Movement Ledger.
describe('customer product category', () => {
  it('migration exists, adds the column, and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).toContain('add column if not exists product_category text');
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('drops the old tgd_upsert_customer_product overload before recreating it with the new parameter', () => {
    const sql = readMigration();
    expect(sql).toContain(
      'drop function if exists public.tgd_upsert_customer_product(\n  uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean\n);',
    );
    expect(sql).toContain('p_product_category text default null');
  });

  it('does not validate product_category against a fixed set of values (free text)', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/product_category must be/i);
  });
});

const {
  fromMock,
} = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock, rpc: vi.fn() },
}));

const { listCustomerProductCategories } = await import('../../src/services/customerProductCatalogService.js');

describe('listCustomerProductCategories', () => {
  it('returns distinct, non-empty categories sorted, scoped to a customer when given one', async () => {
    const chain = {
      select: vi.fn(() => chain),
      not: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      then: (resolve) => resolve({
        data: [
          { product_category: 'ไก่' }, { product_category: 'หมู' },
          { product_category: 'หมู' }, { product_category: null },
        ],
        error: null,
      }),
    };
    fromMock.mockReturnValue(chain);

    const result = await listCustomerProductCategories({ customerId: 'cust-1' });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(['หมู', 'ไก่'].sort());
    expect(chain.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
  });
});
