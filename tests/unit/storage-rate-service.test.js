import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

const {
  listAllProductServiceRates,
  bulkUpsertProductServiceRates,
} = await import('../../src/services/productServiceRatesService.js');

function createChainableQuery(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe('listAllProductServiceRates', () => {
  it('shapes joined rows with customer + product info flattened', async () => {
    fromMock.mockImplementation(() => createChainableQuery({
      data: [{
        id: 'rate-1',
        customer_product_id: 'cp-1',
        service_type: 'STORAGE',
        rate: 2.5,
        unit_basis: 'PER_KG',
        currency: 'THB',
        note: null,
        is_active: true,
        created_at: '2026-01-01',
        tgd_customer_products: {
          id: 'cp-1',
          customer_product_code: 'SKU-1',
          product_name: 'Frozen Shrimp',
          customer_id: 'cust-1',
          tgd_customers: { id: 'cust-1', customer_code: 'CUST-001', customer_name: 'Alpha Cold' },
        },
      }],
      error: null,
    }));

    const result = await listAllProductServiceRates({ customerId: 'cust-1' });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{
      id: 'rate-1',
      customer_product_id: 'cp-1',
      is_all_items: false,
      service_type: 'STORAGE',
      rate: 2.5,
      unit_basis: 'PER_KG',
      period_days: null,
      temperature_type: null,
      max_quantity: null,
      min_charge_amount: null,
      contract_start_date: null,
      contract_end_date: null,
      free_days: null,
      discount_percent: null,
      contract_note: null,
      currency: 'THB',
      note: null,
      is_active: true,
      created_at: '2026-01-01',
      customer_id: 'cust-1',
      customer_code: 'CUST-001',
      customer_name: 'Alpha Cold',
      customer_product_code: 'SKU-1',
      product_name: 'Frozen Shrimp',
    }]);
  });

  it('propagates query errors', async () => {
    fromMock.mockImplementation(() => createChainableQuery({ data: null, error: new Error('boom') }));
    const result = await listAllProductServiceRates();
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('boom');
  });
});

describe('bulkUpsertProductServiceRates', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('applies every row and reports success counts', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'rate-1' }, error: null });

    const result = await bulkUpsertProductServiceRates([
      { customerProductId: 'cp-1', serviceType: 'STORAGE', rate: 2, unitBasis: 'PER_KG' },
      { customerProductId: 'cp-2', serviceType: 'STORAGE', rate: 3, unitBasis: 'PER_KG' },
    ]);

    expect(result.data.total).toBe(2);
    expect(result.data.succeeded).toBe(2);
    expect(result.data.failed).toBe(0);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it('collects per-row errors without aborting the batch', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { id: 'rate-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('Admin role required') });

    const result = await bulkUpsertProductServiceRates([
      { customerProductId: 'cp-1', serviceType: 'STORAGE', rate: 2, unitBasis: 'PER_KG' },
      { customerProductId: 'cp-2', serviceType: 'STORAGE', rate: 3, unitBasis: 'PER_KG' },
    ]);

    expect(result.data.total).toBe(2);
    expect(result.data.succeeded).toBe(1);
    expect(result.data.failed).toBe(1);
    expect(result.data.errors[0].message).toBe('Admin role required');
  });
});
