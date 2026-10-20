import { describe, expect, it, vi } from 'vitest';
import { computeHandlingOutFeeLines, findHandlingOutLinesMissingWeight } from '../../src/utils/billingRateCalc.js';
import { buildInvoiceDraftLineFromHandlingOutLine } from '../../src/utils/billingInvoiceDraftUtils.js';

// HANDLING_OUT (ค่านำออก) used to be billable only from the Billing Movement
// Weight report's movement-based draft flow. The period-based invoice draft
// now bills it per withdrawal line: picked weight x rate, in the period that
// contains the withdrawal's confirmed dispatch date.

const CUSTOMER_ID = 'cust-1';

const HANDLING_OUT_RATE = {
  id: 'rate-out', customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type: 'HANDLING_OUT', rate: 0.3, unit_basis: 'PER_KG', currency: 'THB',
  note: 'ค่านำออก', is_active: true, period_days: null,
  temperature_type: null, max_quantity: null, created_at: '2026-01-01T00:00:00Z',
};

const STORAGE_RATE = {
  id: 'rate-storage', customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type: 'STORAGE', rate: 5, unit_basis: 'PER_KG', currency: 'THB',
  note: null, is_active: true, period_days: 30,
  temperature_type: 'FROZEN', max_quantity: null, created_at: '2026-01-01T00:00:00Z',
};

describe('computeHandlingOutFeeLines', () => {
  const base = {
    id: 'wl-1', withdrawalNo: 'CWR-1', customerId: CUSTOMER_ID, customerProductId: null,
    temperatureType: 'FROZEN', weight: 400, dispatchDate: '2026-07-15',
  };

  it('bills picked weight x rate for a dispatch inside the period', () => {
    const lines = computeHandlingOutFeeLines({
      lines: [base], rates: [HANDLING_OUT_RATE], periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBeCloseTo(120, 2);
    expect(lines[0].rate.id).toBe('rate-out');
  });

  it('skips dispatches outside the period, zero-weight lines and customers with no HANDLING_OUT rate', () => {
    const args = { rates: [HANDLING_OUT_RATE], periodStart: '2026-07-01', periodEnd: '2026-07-31' };
    expect(computeHandlingOutFeeLines({ ...args, lines: [{ ...base, dispatchDate: '2026-08-01' }] })).toHaveLength(0);
    expect(computeHandlingOutFeeLines({ ...args, lines: [{ ...base, dispatchDate: null }] })).toHaveLength(0);
    expect(computeHandlingOutFeeLines({ ...args, lines: [{ ...base, weight: 0 }] })).toHaveLength(0);
    expect(computeHandlingOutFeeLines({ ...args, rates: [STORAGE_RATE], lines: [base] })).toHaveLength(0);
  });
});

describe('buildInvoiceDraftLineFromHandlingOutLine', () => {
  it('builds a HANDLING_OUT draft line that points back to the withdrawal and the lot', () => {
    const line = buildInvoiceDraftLineFromHandlingOutLine({
      withdrawalNo: 'CWR-1', customerId: CUSTOMER_ID, depositLineId: 'line-1', productCode: 'P1',
      productName: 'Product 1', lotNo: 'LOT-1', weight: 400, amount: 120, dispatchDate: '2026-07-15',
      rate: HANDLING_OUT_RATE,
    });
    expect(line).toMatchObject({
      source_document_type: 'HANDLING_OUT', movement_type: 'HANDLING_OUT', source_document_no: 'CWR-1',
      deposit_line_id: 'line-1', movement_date: '2026-07-15', chargeable_weight: 400, rate: 0.3,
      amount: 120, service_rate_id: 'rate-out', min_charge_applied: false, free_period_applied: false,
    });
    expect(line.line_note).toContain('ค่านำออก');
  });
});

// Same filter-aware in-memory fake of the supabase query builder used by
// billing-freeze-frozen-storage.test.js.
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
    tgd_customer_deposit_requests: [{
      id: 'dep-1', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
      expected_arrival_date: '2026-06-05', last_action_at: null, requires_r3_document: false,
      tgd_customer_deposit_request_lines: [{
        id: 'line-1', customer_product_code: 'P1', temperature_type: 'FROZEN',
        tracking_code: 'TC1', lot_no: 'LOT-1',
        actual_boxes: 10, actual_weight: 1000, expected_boxes: 10, expected_weight: 1000,
      }],
    }],
    tgd_customer_withdrawal_requests: [
      {
        id: 'wd-1', withdrawal_no: 'CWR-JUL', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-07-15', requires_r3_document: false,
        tgd_customer_withdrawal_request_lines: [{
          id: 'wl-1', source_customer_deposit_request_line_id: 'line-1', tracking_code: 'TC1',
          customer_product_code: 'P1', picked_boxes: 4, picked_weight: 400, picked_at: '2026-07-15T03:00:00Z',
        }],
      },
      {
        id: 'wd-2', withdrawal_no: 'CWR-AUG', customer_id: CUSTOMER_ID, status: 'COMPLETED',
        requested_dispatch_date: '2026-08-02', requires_r3_document: false,
        tgd_customer_withdrawal_request_lines: [{
          id: 'wl-2', source_customer_deposit_request_line_id: 'line-1', tracking_code: 'TC1',
          customer_product_code: 'P1', picked_boxes: 2, picked_weight: 200, picked_at: '2026-08-02T03:00:00Z',
        }],
      },
    ],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [],
    tgd_customer_product_service_rates: [STORAGE_RATE, HANDLING_OUT_RATE],
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview — HANDLING_OUT', () => {
  it('bills only the withdrawals dispatched in the period, tied to the lot they came from', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));
    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID, periodStart: '2026-07-01', periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();
    expect(data.handlingOutLines).toHaveLength(1);
    expect(data.handlingOutLines[0]).toMatchObject({
      withdrawalNo: 'CWR-JUL', depositLineId: 'line-1', lotNo: 'LOT-1', weight: 400, dispatchDate: '2026-07-15',
    });
    expect(data.handlingOutLines[0].amount).toBeCloseTo(120, 2);
  });

  it('leaves HANDLING_OUT out when the draft is scoped to a different storage room', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));
    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID, periodStart: '2026-07-01', periodEnd: '2026-07-31', temperatureType: 'CHILLED',
    });

    expect(data.handlingOutLines).toHaveLength(0);
  });
});

describe('computeHandlingOutFeeLines — rate eligibility', () => {
  const line = {
    id: 'wl-1', withdrawalNo: 'CWR-1', customerId: CUSTOMER_ID, customerProductId: null,
    temperatureType: 'FREEZE_FROZEN', weight: 100, dispatchDate: '2026-07-15',
  };
  const period = { periodStart: '2026-07-01', periodEnd: '2026-07-31' };

  it('ignores FLAT and PER_HOUR HANDLING_OUT rates, which are billed as per-document services', () => {
    const flat = { ...HANDLING_OUT_RATE, id: 'rate-flat', unit_basis: 'FLAT', rate: 500 };
    const hourly = { ...HANDLING_OUT_RATE, id: 'rate-hour', unit_basis: 'PER_HOUR', rate: 300 };
    expect(computeHandlingOutFeeLines({ ...period, lines: [line], rates: [flat, hourly] })).toHaveLength(0);
  });

  it('bills a Freeze & Frozen lot at the FROZEN HANDLING_OUT rate when it has no rate of its own', () => {
    const frozenOnly = { ...HANDLING_OUT_RATE, id: 'rate-frozen-out', temperature_type: 'FROZEN' };
    const lines = computeHandlingOutFeeLines({ ...period, lines: [line], rates: [frozenOnly] });
    expect(lines).toHaveLength(1);
    expect(lines[0].rate.id).toBe('rate-frozen-out');
    expect(lines[0].amount).toBeCloseTo(30, 2);
  });
});

describe('findHandlingOutLinesMissingWeight', () => {
  const period = { periodStart: '2026-07-01', periodEnd: '2026-07-31' };
  const base = {
    id: 'wl-1', withdrawalNo: 'CWR-1', customerId: CUSTOMER_ID, customerProductId: null,
    temperatureType: 'FROZEN', dispatchDate: '2026-07-15',
  };

  it('flags a boxes-only pick that a HANDLING_OUT rate would have billed', () => {
    const flagged = findHandlingOutLinesMissingWeight({
      ...period, rates: [HANDLING_OUT_RATE], lines: [{ ...base, weight: 0, pickedBoxes: 40 }],
    });
    expect(flagged.map((l) => l.id)).toEqual(['wl-1']);
  });

  it('ignores lines that have a weight, have no boxes either, fall outside the period, or have no rate', () => {
    const args = { ...period, rates: [HANDLING_OUT_RATE] };
    expect(findHandlingOutLinesMissingWeight({ ...args, lines: [{ ...base, weight: 400, pickedBoxes: 40 }] })).toHaveLength(0);
    expect(findHandlingOutLinesMissingWeight({ ...args, lines: [{ ...base, weight: 0, pickedBoxes: 0 }] })).toHaveLength(0);
    expect(findHandlingOutLinesMissingWeight({ ...args, lines: [{ ...base, weight: 0, pickedBoxes: 40, dispatchDate: '2026-08-02' }] })).toHaveLength(0);
    expect(findHandlingOutLinesMissingWeight({ ...args, rates: [STORAGE_RATE], lines: [{ ...base, weight: 0, pickedBoxes: 40 }] })).toHaveLength(0);
  });
});
