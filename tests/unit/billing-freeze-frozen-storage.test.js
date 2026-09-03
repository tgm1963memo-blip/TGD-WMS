import { describe, expect, it, vi } from 'vitest';

// Regression coverage for the Freeze & Frozen storage billing fix: a deposit
// line stored as FREEZE_FROZEN must bill under the customer's FROZEN STORAGE
// rate (same physical frozen room, no separate rate configuration needed),
// while a separate FREEZING service fee -- if the customer has one
// configured -- shows as its own distinct invoice line, not folded into the
// storage charge.
//
// Same filter-aware in-memory fake of the supabase query builder used
// elsewhere in this suite (e.g. billing-r3-document-fee.test.js).

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = row[col];
      if (type === 'eq') return actual === val;
      if (type === 'in') return vals.includes(actual);
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

function makeDb({ rates }) {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'dep-1', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-05', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [
          {
            id: 'line-1', customer_product_code: 'PROD-FF', temperature_type: 'FREEZE_FROZEN',
            tracking_code: 'FF260705001', lot_no: 'LOT-1',
            actual_boxes: 10, actual_weight: 1000, expected_boxes: 10, expected_weight: 1000,
          },
        ],
      },
    ],
    tgd_customer_withdrawal_requests: [],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [],
    tgd_customer_product_service_rates: rates,
    tgd_customer_products: [],
  };
}

const FROZEN_STORAGE_RATE = {
  id: 'rate-frozen', customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type: 'STORAGE', rate: 5, unit_basis: 'PER_KG', currency: 'THB',
  note: null, is_active: true, period_days: 30,
  temperature_type: 'FROZEN', max_quantity: null, created_at: '2026-01-01T00:00:00Z',
};

const FREEZING_FEE_RATE = {
  id: 'rate-freezing', customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type: 'FREEZING', rate: 0.5, unit_basis: 'PER_KG', currency: 'THB',
  note: 'ค่าฟรีส', is_active: true, period_days: null,
  temperature_type: null, max_quantity: null, created_at: '2026-01-01T00:00:00Z',
};

describe('getBillingPeriodPreview — Freeze & Frozen storage + freezing fee', () => {
  it('bills a FREEZE_FROZEN lot under the FROZEN storage rate, not as unrated', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb({ rates: [FROZEN_STORAGE_RATE] })) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.unratedDepositLines).toHaveLength(0);
    expect(data.storageLines).toHaveLength(1);
    expect(data.storageLines[0].amount).toBe(5000);
    expect(data.storageLines[0].rate.id).toBe('rate-frozen');
  });

  it('adds a separate FREEZING fee line, distinct from the storage line, when a FREEZING rate is configured', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: makeSupabaseMock(makeDb({ rates: [FROZEN_STORAGE_RATE, FREEZING_FEE_RATE] })),
    }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.storageLines).toHaveLength(1);
    const freezingLines = data.handlingLines.filter((l) => l.rate?.service_type === 'FREEZING');
    expect(freezingLines).toHaveLength(1);
    expect(freezingLines[0].amount).toBeCloseTo(500, 2);
    expect(freezingLines[0].depositLineId).toBe('line-1');
  });

  it('does not add a FREEZING fee line for an ordinary FROZEN (non-Freeze&Frozen) deposit line, even when a FREEZING rate exists', async () => {
    vi.resetModules();
    const db = makeDb({ rates: [FROZEN_STORAGE_RATE, FREEZING_FEE_RATE] });
    db.tgd_customer_deposit_requests[0].tgd_customer_deposit_request_lines[0].temperature_type = 'FROZEN';
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    const freezingLines = data.handlingLines.filter((l) => l.rate?.service_type === 'FREEZING');
    expect(freezingLines).toHaveLength(0);
  });
});
