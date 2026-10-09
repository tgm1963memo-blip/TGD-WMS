import { describe, expect, it, vi } from 'vitest';
import { computeOvertimeWeightLines } from '../../src/utils/billingRateCalc.js';
import { buildInvoiceDraftLineFromOvertimeLine } from '../../src/utils/billingInvoiceDraftUtils.js';

// "คิด OT" flag on deposit/withdrawal requests (is_overtime): OT is billed by
// weight — each line's weight x the customer's OVERTIME PER_KG rate. Uses the
// same in-memory fake supabase query builder as
// billing-withdrawal-aux-services.test.js for the engine-level cases.

const CUSTOMER_ID = 'cust-1';

const perKgRate = {
  id: 'rate-ot-kg', customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type: 'OVERTIME', rate: 0.5, unit_basis: 'PER_KG', currency: 'THB',
  note: 'ค่าล่วงเวลา (OT)', is_active: true, temperature_type: null,
};
const productRate = {
  ...perKgRate, id: 'rate-ot-kg-p1', customer_product_id: 'prod-1', rate: 0.8,
};
const perHourRate = {
  ...perKgRate, id: 'rate-ot-hr', unit_basis: 'PER_HOUR', rate: 150,
};

describe('computeOvertimeWeightLines', () => {
  it('charges weight x the PER_KG OVERTIME rate per line', () => {
    const result = computeOvertimeWeightLines({
      lines: [
        { id: 'l1', requestId: 'r1', customerId: CUSTOMER_ID, customerProductId: 'prod-9', weight: 52 },
        { id: 'l2', requestId: 'r1', customerId: CUSTOMER_ID, customerProductId: 'prod-9', weight: 147 },
      ],
      rates: [perKgRate],
    });
    expect(result.map((l) => l.amount)).toEqual([26, 73.5]);
    expect(result[0].sourceRequestId).toBe('r1');
  });

  it('prefers a product-specific OT rate over the customer-wide one', () => {
    const [line] = computeOvertimeWeightLines({
      lines: [{ id: 'l1', requestId: 'r1', customerId: CUSTOMER_ID, customerProductId: 'prod-1', weight: 100 }],
      rates: [perKgRate, productRate],
    });
    expect(line.rate.id).toBe('rate-ot-kg-p1');
    expect(line.amount).toBe(80);
  });

  it('ignores FLAT/PER_HOUR OVERTIME rates (those bill through aux services)', () => {
    const result = computeOvertimeWeightLines({
      lines: [{ id: 'l1', requestId: 'r1', customerId: CUSTOMER_ID, customerProductId: null, weight: 100 }],
      rates: [perHourRate],
    });
    expect(result).toHaveLength(0);
  });
});

describe('buildInvoiceDraftLineFromOvertimeLine', () => {
  it('builds a per-kg OVERTIME draft line without tying it to a lot', () => {
    const row = buildInvoiceDraftLineFromOvertimeLine({
      customerId: CUSTOMER_ID, rate: perKgRate, weight: 52, amount: 26, date: '2026-10-09',
      requestType: 'WITHDRAWAL', productCode: '20165', productName: 'ไส้กรอก',
    });
    expect(row).toMatchObject({
      source_document_type: 'OVERTIME', uom: 'กก.', chargeable_weight: 52, rate: 0.5, amount: 26,
      deposit_line_id: null, min_charge_applied: false, free_period_applied: false,
    });
  });
});

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = row[col];
      if (type === 'eq') return actual === val;
      if (type === 'neq') return actual !== val;
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
      neq: (col, val) => { filters.push({ type: 'neq', col, val }); return builder; },
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

function makeDb() {
  return {
    tgd_customer_deposit_requests: [],
    tgd_customer_withdrawal_requests: [
      {
        id: 'wd-ot', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-10-09', requires_r3_document: false, is_overtime: true,
        tgd_customer_withdrawal_request_lines: [
          { customer_product_code: '20165', picked_boxes: 5, picked_weight: 52 },
          { customer_product_code: '20165', picked_boxes: 15, picked_weight: 147 },
        ],
      },
      {
        id: 'wd-no-ot', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-10-09', requires_r3_document: false, is_overtime: false,
        tgd_customer_withdrawal_request_lines: [
          { customer_product_code: '20165', picked_boxes: 10, picked_weight: 500 },
        ],
      },
      {
        id: 'wd-ot-september', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-09-20', requires_r3_document: false, is_overtime: true,
        tgd_customer_withdrawal_request_lines: [
          { customer_product_code: '20165', picked_boxes: 10, picked_weight: 500 },
        ],
      },
    ],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [],
    tgd_customer_product_service_rates: [{ ...perKgRate, created_at: '2026-07-01T00:00:00Z' }],
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview — คิด OT by weight', () => {
  it('bills only flagged documents confirmed inside the period', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));
    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID, periodStart: '2026-10-01', periodEnd: '2026-10-31',
    });

    expect(error).toBeFalsy();
    expect(data.overtimeLines).toHaveLength(2);
    expect(data.overtimeLines.every((l) => l.sourceRequestId === 'wd-ot')).toBe(true);
    expect(data.overtimeLines.reduce((sum, l) => sum + l.amount, 0)).toBe(99.5); // (52 + 147) x 0.5
  });
});
