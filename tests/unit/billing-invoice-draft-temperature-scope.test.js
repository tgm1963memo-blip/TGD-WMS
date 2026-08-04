import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a new feature: creating a storage/service invoice
// draft can now be scoped to one storage method (temperature_type) instead
// of always covering every lot for the period — e.g. billing FROZEN
// separately from CHILLED for the same customer and period. Uses the same
// filter-aware in-memory fake of the supabase query builder used elsewhere
// in this suite (see billing-r3-document-fee.test.js).

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = row[col];
      if (type === 'eq') return actual === val;
      if (type === 'in') return vals.includes(actual);
      if (type === 'lte') return actual <= val;
      if (type === 'gte') return actual >= val;
      if (type === 'neq') return actual !== val;
      return true;
    })
  );
}

function makeSupabaseMock(db) {
  const from = vi.fn((table) => {
    const filters = [];
    const builder = {
      select: () => builder,
      eq: (col, val) => { filters.push({ type: 'eq', col, val }); return builder; },
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      lte: (col, val) => { filters.push({ type: 'lte', col, val }); return builder; },
      gte: (col, val) => { filters.push({ type: 'gte', col, val }); return builder; },
      neq: (col, val) => { filters.push({ type: 'neq', col, val }); return builder; },
      or: () => builder,
      order: () => builder,
      then: (resolve, reject) => {
        const rows = applyFilters(db[table] ?? [], filters);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

const CUSTOMER_ID = 'cust-1';

function makeDb() {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'dep-frozen', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-05', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [
          {
            id: 'line-frozen', customer_product_code: 'P-FROZEN', temperature_type: 'FROZEN',
            tracking_code: 'FR001', lot_no: 'L1', actual_boxes: 10, actual_weight: 100,
            expected_boxes: 10, expected_weight: 100,
          },
        ],
      },
      {
        id: 'dep-chilled', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-05', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [
          {
            id: 'line-chilled', customer_product_code: 'P-CHILLED', temperature_type: 'CHILLED',
            tracking_code: 'CH001', lot_no: 'L2', actual_boxes: 5, actual_weight: 50,
            expected_boxes: 5, expected_weight: 50,
          },
        ],
      },
    ],
    tgd_customer_withdrawal_requests: [],
    tgd_customer_deposit_request_services: [],
    tgd_customer_product_service_rates: [
      {
        id: 'rate-frozen', customer_id: CUSTOMER_ID, customer_product_id: null,
        service_type: 'STORAGE', rate: 2, unit_basis: 'PER_KG', currency: 'THB',
        note: null, is_active: true, period_days: null, temperature_type: 'FROZEN',
        max_quantity: null, created_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'rate-chilled', customer_id: CUSTOMER_ID, customer_product_id: null,
        service_type: 'STORAGE', rate: 3, unit_basis: 'PER_KG', currency: 'THB',
        note: null, is_active: true, period_days: null, temperature_type: 'CHILLED',
        max_quantity: null, created_at: '2026-07-01T00:00:00Z',
      },
    ],
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview — temperatureType scope', () => {
  it('includes every storage type when temperatureType is omitted', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');
    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID, periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.storageLines).toHaveLength(2);
  });

  it('only bills the matching storage type when temperatureType is set', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');
    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID, periodStart: '2026-07-01', periodEnd: '2026-07-31', temperatureType: 'FROZEN',
    });

    expect(error).toBeFalsy();
    expect(data.storageLines).toHaveLength(1);
    expect(data.storageLines[0].depositLineId).toBe('line-frozen');
  });
});

describe('findOverlappingBillingPeriodDrafts — temperatureType scope', () => {
  it('does not flag two differently-scoped active drafts covering the same period as overlapping', async () => {
    vi.resetModules();
    const db = {
      tgd_billing_invoice_drafts: [
        {
          id: 'draft-frozen', customer_id: CUSTOMER_ID, draft_no: 'BID-1', status: 'DRAFT',
          billing_period_start: '2026-07-01', billing_period_end: '2026-07-31', temperature_type: 'FROZEN',
        },
      ],
    };
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { findOverlappingBillingPeriodDrafts } = await import('../../src/services/billingInvoiceDraftService.js');
    const result = await findOverlappingBillingPeriodDrafts({
      customerId: CUSTOMER_ID, billingPeriodStart: '2026-07-01', billingPeriodEnd: '2026-07-31', temperatureType: 'CHILLED',
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it('flags an unscoped (all-types) active draft as overlapping regardless of the new scope', async () => {
    vi.resetModules();
    const db = {
      tgd_billing_invoice_drafts: [
        {
          id: 'draft-all', customer_id: CUSTOMER_ID, draft_no: 'BID-2', status: 'DRAFT',
          billing_period_start: '2026-07-01', billing_period_end: '2026-07-31', temperature_type: null,
        },
      ],
    };
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { findOverlappingBillingPeriodDrafts } = await import('../../src/services/billingInvoiceDraftService.js');
    const result = await findOverlappingBillingPeriodDrafts({
      customerId: CUSTOMER_ID, billingPeriodStart: '2026-07-01', billingPeriodEnd: '2026-07-31', temperatureType: 'FROZEN',
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it('flags two drafts with the same scope for the same period as overlapping', async () => {
    vi.resetModules();
    const db = {
      tgd_billing_invoice_drafts: [
        {
          id: 'draft-frozen', customer_id: CUSTOMER_ID, draft_no: 'BID-3', status: 'DRAFT',
          billing_period_start: '2026-07-01', billing_period_end: '2026-07-31', temperature_type: 'FROZEN',
        },
      ],
    };
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { findOverlappingBillingPeriodDrafts } = await import('../../src/services/billingInvoiceDraftService.js');
    const result = await findOverlappingBillingPeriodDrafts({
      customerId: CUSTOMER_ID, billingPeriodStart: '2026-07-01', billingPeriodEnd: '2026-07-31', temperatureType: 'FROZEN',
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });
});
