import { describe, expect, it, vi } from 'vitest';
import { normalizeStockBalanceRow, queryStockBalanceRows } from '../../src/services/stockBalanceRowQuery.js';

describe('stockBalanceRowQuery', () => {
  it('normalizes legacy quantity columns into qty_on_hand', () => {
    const row = normalizeStockBalanceRow({
      id: 'bal-1',
      customer_id: 'cust-1',
      product_id: 'prod-1',
      lot_id: 'lot-1',
      location_id: 'loc-1',
      quantity: 12,
    });

    expect(row.qty_on_hand).toBe(12);
    expect(row.qty_allocated).toBe(0);
    expect(row.qty_available).toBe(12);
    expect(row.warehouse_id).toBeNull();
  });

  it('falls back to legacy select when warehouse_id column is missing', async () => {
    const extendedQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    const legacyQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(extendedQuery)
        .mockReturnValueOnce(legacyQuery),
    };

    extendedQuery.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'column tgd_stock_balances.warehouse_id does not exist' },
    });

    legacyQuery.eq.mockResolvedValueOnce({
      data: [{
        id: 'bal-1',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        lot_id: 'lot-1',
        location_id: 'loc-1',
        quantity: 5,
        created_at: '2026-06-08T00:00:00Z',
      }],
      error: null,
    });

    const applyFilters = (query, filters = {}) => {
      if (filters.customerId) {
        return query.eq('customer_id', filters.customerId);
      }
      return query;
    };

    const result = await queryStockBalanceRows(supabase, { customerId: 'cust-1' }, applyFilters);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].qty_on_hand).toBe(5);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
