import { describe, expect, it, vi } from 'vitest';

// Regression coverage for the ร.3 document fee: a deposit or withdrawal
// request flagged requires_r3_document should bill exactly one flat fee
// (quantity 1 × the customer's configured R3_DOCUMENT rate) per confirmed
// document that falls inside the billing period — not scaled by weight,
// not duplicated per line, and not billed at all for unflagged documents or
// documents outside the period.
//
// Same filter-aware in-memory fake of the supabase query builder used
// elsewhere in this suite (e.g. customer-withdrawal-sibling-balance.test.js)
// so the test exercises the real .eq()/.in() arguments the service code
// builds, rather than a hand-fed return value.

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

function makeDb() {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'dep-in-period', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-05', last_action_at: null, requires_r3_document: true,
        tgd_customer_deposit_request_lines: [],
      },
      {
        id: 'dep-out-of-period', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-06-05', last_action_at: null, requires_r3_document: true,
        tgd_customer_deposit_request_lines: [],
      },
      {
        id: 'dep-not-flagged', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-10', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [],
      },
    ],
    tgd_customer_withdrawal_requests: [
      {
        id: 'wd-in-period', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-07-20', requires_r3_document: true,
        tgd_customer_withdrawal_request_lines: [],
      },
    ],
    tgd_customer_deposit_request_services: [],
    tgd_customer_product_service_rates: [
      {
        id: 'rate-r3', customer_id: CUSTOMER_ID, customer_product_id: null,
        service_type: 'R3_DOCUMENT', rate: 30, unit_basis: 'FLAT', currency: 'THB',
        note: 'ค่าบริการดำเนินการเอกสาร ร.3', is_active: true, period_days: null,
        temperature_type: null, max_quantity: null, created_at: '2026-07-01T00:00:00Z',
      },
    ],
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview — ร.3 document fee', () => {
  it('bills exactly one flat fee per flagged, confirmed document inside the period', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();

    const r3Lines = data.auxLines.filter((l) => l.rate?.service_type === 'R3_DOCUMENT');
    expect(r3Lines).toHaveLength(2);
    expect(r3Lines.map((l) => l.depositRequestId).sort()).toEqual(['dep-in-period', 'wd-in-period']);
    for (const line of r3Lines) {
      expect(line.quantity).toBe(1);
      expect(line.amount).toBe(30);
    }
  });

  it('does not bill anything when no rate is configured for R3_DOCUMENT', async () => {
    vi.resetModules();
    const db = makeDb();
    db.tgd_customer_product_service_rates = [];
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.auxLines.filter((l) => l.rate?.service_type === 'R3_DOCUMENT')).toHaveLength(0);
  });
});
