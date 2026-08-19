import { describe, expect, it, vi } from 'vitest';

// Regression coverage for Part G: withdrawal-side auxiliary services
// (plug-in/OT/etc. selected against a withdrawal request rather than a
// deposit — tgd_customer_withdrawal_request_services), mirroring the
// existing deposit-side mechanism. Uses the same filter-aware in-memory
// fake supabase query builder as billing-r3-document-fee.test.js.

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
    tgd_customer_deposit_requests: [],
    tgd_customer_withdrawal_requests: [
      {
        id: 'wd-in-period', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-07-15', requires_r3_document: false,
        tgd_customer_withdrawal_request_lines: [],
      },
      {
        id: 'wd-out-of-period', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-06-15', requires_r3_document: false,
        tgd_customer_withdrawal_request_lines: [],
      },
    ],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [
      { id: 'sel-1', withdrawal_request_id: 'wd-in-period', service_rate_id: 'rate-ot', quantity: 3, note: 'ค่าล่วงเวลา 3 ชม.' },
      { id: 'sel-2', withdrawal_request_id: 'wd-out-of-period', service_rate_id: 'rate-ot', quantity: 2, note: null },
    ],
    tgd_customer_product_service_rates: [
      {
        id: 'rate-ot', customer_id: CUSTOMER_ID, customer_product_id: null,
        service_type: 'OVERTIME', rate: 150, unit_basis: 'PER_HOUR', currency: 'THB',
        note: 'ค่าล่วงเวลา', is_active: true, period_days: null,
        temperature_type: null, max_quantity: 12, created_at: '2026-07-01T00:00:00Z',
      },
    ],
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview — withdrawal-side auxiliary services (Part G)', () => {
  it('bills an OVERTIME selection recorded against a withdrawal request within the period', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    const otLines = data.auxLines.filter((l) => l.rate?.service_type === 'OVERTIME');
    // Only the in-period selection should appear — the out-of-period one
    // (dispatch date in June) must not leak into a July billing run.
    expect(otLines).toHaveLength(1);
    expect(otLines[0].sourceRequestId).toBe('wd-in-period');
    expect(otLines[0].quantity).toBe(3);
    expect(otLines[0].amount).toBe(450); // 3 hours x 150 บาท/ชม.
  });

  it('caps OVERTIME quantity at the rate\'s max_quantity, same as the deposit-side mechanism', async () => {
    vi.resetModules();
    const db = makeDb();
    db.tgd_customer_withdrawal_request_services = [
      { id: 'sel-1', withdrawal_request_id: 'wd-in-period', service_rate_id: 'rate-ot', quantity: 20, note: null },
    ];
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    const [otLine] = data.auxLines.filter((l) => l.rate?.service_type === 'OVERTIME');
    expect(otLine.quantity).toBe(12); // capped at max_quantity
    expect(otLine.amount).toBe(1800); // 12 x 150
  });

  it('produces nothing when no withdrawal-side selections exist (no regression to deposit-only customers)', async () => {
    vi.resetModules();
    const db = makeDb();
    db.tgd_customer_withdrawal_request_services = [];
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.auxLines).toHaveLength(0);
  });
});
