import { describe, expect, it, vi } from 'vitest';
import {
  bangkokDateOf, computeOvertimePoolLines, groupOvertimeLinesByDocument,
} from '../../src/utils/billingRateCalc.js';
import { buildInvoiceDraftLineFromOvertimeLine } from '../../src/utils/billingInvoiceDraftUtils.js';

// "คิด OT" billing: OT is pooled per customer + work day + OT type
// (WORKDAY → OVERTIME rate, HOLIDAY → OVERTIME_HOLIDAY rate). The pool is
// weight x PER_KG rate, raised to the rate's min_charge_amount once per
// pool, then spread back over the documents by weight.

const CUSTOMER_ID = 'cust-1';

const workdayRate = {
  id: 'rate-ot', customer_id: CUSTOMER_ID, customer_product_id: null, service_type: 'OVERTIME',
  rate: 0.2, unit_basis: 'PER_KG', min_charge_amount: 2000, is_active: true, temperature_type: null,
};
const holidayRate = {
  ...workdayRate, id: 'rate-ot-hol', service_type: 'OVERTIME_HOLIDAY', rate: 0.3, min_charge_amount: 3000,
};
const perHourRate = { ...workdayRate, id: 'rate-ot-hr', unit_basis: 'PER_HOUR', rate: 150, min_charge_amount: null };

function line(requestId, weight, extra = {}) {
  return {
    id: `${requestId}:${weight}`, requestId, requestType: 'WITHDRAWAL', requestNo: requestId,
    customerId: CUSTOMER_ID, customerProductId: null, weight, workDate: '2026-10-15', overtimeType: 'WORKDAY', ...extra,
  };
}

const sum = (rows) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

describe('computeOvertimePoolLines', () => {
  it('charges the minimum once for several documents on the same day, spread by weight', () => {
    const rows = computeOvertimePoolLines({
      lines: [line('A', 1000), line('B', 2000), line('C', 3000, { requestType: 'DEPOSIT' })],
      rates: [workdayRate],
    });
    expect(rows.map((r) => r.amount)).toEqual([333.33, 666.67, 1000]);
    expect(sum(rows)).toBe(2000);
    expect(rows[0].pool).toMatchObject({ documentCount: 3, totalWeight: 6000, rawAmount: 1200, poolAmount: 2000, minApplied: true });
  });

  it('charges actual weight x rate when the pool is above the minimum', () => {
    const rows = computeOvertimePoolLines({ lines: [line('A', 8000), line('B', 4000)], rates: [workdayRate] });
    expect(rows.map((r) => r.amount)).toEqual([1600, 800]);
    expect(rows[0].pool.minApplied).toBe(false);
  });

  it('applies the minimum separately to different days', () => {
    const rows = computeOvertimePoolLines({
      lines: [line('A', 1000), line('B', 1000, { workDate: '2026-10-16' })],
      rates: [workdayRate],
    });
    expect(rows.map((r) => r.amount)).toEqual([2000, 2000]);
  });

  it('pools workday and holiday OT separately, each with its own rate and minimum', () => {
    const rows = computeOvertimePoolLines({
      lines: [line('A', 20000), line('B', 1000, { overtimeType: 'HOLIDAY' })],
      rates: [workdayRate, holidayRate],
    });
    const byDoc = Object.fromEntries(rows.map((r) => [r.sourceRequestId, r]));
    expect(byDoc.A.amount).toBe(4000);
    expect(byDoc.A.rate.id).toBe('rate-ot');
    expect(byDoc.B.amount).toBe(3000);
    expect(byDoc.B.rate.id).toBe('rate-ot-hol');
  });

  it('bills nothing for holiday OT when no holiday rate is set', () => {
    const rows = computeOvertimePoolLines({ lines: [line('A', 1000, { overtimeType: 'HOLIDAY' })], rates: [workdayRate] });
    expect(rows).toHaveLength(0);
  });

  it('ignores FLAT/PER_HOUR OVERTIME rates (those bill through aux services)', () => {
    expect(computeOvertimePoolLines({ lines: [line('A', 1000)], rates: [perHourRate] })).toHaveLength(0);
  });

  it('rounding remainder lands on the last line so shares add up exactly', () => {
    const rows = computeOvertimePoolLines({ lines: [line('A', 1), line('B', 1), line('C', 1)], rates: [workdayRate] });
    expect(rows.map((r) => r.amount)).toEqual([666.67, 666.67, 666.66]);
    expect(sum(rows)).toBe(2000);
  });

  it('groups line shares into one entry per document', () => {
    const rows = computeOvertimePoolLines({
      lines: [line('A', 500), { ...line('A', 500), id: 'A:2' }, line('B', 1000)],
      rates: [workdayRate],
    });
    const docs = groupOvertimeLinesByDocument(rows);
    expect(docs.map((d) => [d.sourceRequestId, d.weight, d.amount])).toEqual([['A', 1000, 1000], ['B', 1000, 1000]]);
  });
});

describe('bangkokDateOf', () => {
  it('uses Thai local date', () => {
    expect(bangkokDateOf('2026-10-14T23:30:00Z')).toBe('2026-10-15');
    expect(bangkokDateOf('2026-10-15T10:00:00Z')).toBe('2026-10-15');
    expect(bangkokDateOf(null)).toBeNull();
  });
});

describe('buildInvoiceDraftLineFromOvertimeLine', () => {
  it('builds one draft line per document with the pool explained in the note', () => {
    const [doc] = groupOvertimeLinesByDocument(computeOvertimePoolLines({
      lines: [line('CWR-20261015-0007', 1000), line('CWR-20261015-0008', 2000)], rates: [workdayRate],
    }));
    const row = buildInvoiceDraftLineFromOvertimeLine(doc);
    expect(row).toMatchObject({
      source_document_type: 'OVERTIME', source_document_no: 'CWR-20261015-0007', uom: 'กก.',
      chargeable_weight: 1000, amount: 666.67, min_charge_applied: true, deposit_line_id: null,
    });
    expect(row.product_name).toBe('ค่าล่วงเวลา (OT) วันทำการ 15/10/2026 — CWR-20261015-0007');
    expect(row.line_note).toContain('2 ใบ');
    expect(row.line_note).toContain('ขั้นต่ำ 2,000.00');
  });
});

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
      neq: () => builder,
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      not: () => builder,
      or: () => builder,
      order: () => builder,
      then: (resolve, reject) => Promise.resolve({ data: applyFilters(db[table] ?? [], filters), error: null }).then(resolve, reject),
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

// Two OT withdrawals started the evening of 15/10 (Bangkok), one of them
// Raw material and one Finished Goods, plus one non-OT withdrawal.
function makeDb() {
  const wd = (id, weight, code, extra = {}) => ({
    id, withdrawal_no: id, customer_id: CUSTOMER_ID, status: 'COMPLETED', requested_dispatch_date: '2026-10-15',
    requires_r3_document: false, is_overtime: true, overtime_type: 'WORKDAY', dispatch_started_at: '2026-10-15T12:00:00Z',
    tgd_customer_withdrawal_request_lines: [{ customer_product_code: code, picked_boxes: 1, picked_weight: weight }],
    ...extra,
  });
  return {
    tgd_customer_deposit_requests: [],
    tgd_customer_withdrawal_requests: [
      wd('CWR-A', 1000, 'RM-1'),
      wd('CWR-B', 3000, 'FG-1'),
      wd('CWR-X', 9000, 'FG-1', { is_overtime: false }),
    ],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [],
    tgd_customer_document_timeline_events: [],
    tgd_customer_product_service_rates: [{ ...workdayRate, created_at: '2026-07-01T00:00:00Z' }],
    tgd_customer_products: [
      { id: 'p-rm', customer_id: CUSTOMER_ID, customer_product_code: 'RM-1', temperature_type: 'FROZEN', product_category: 'Raw material' },
      { id: 'p-fg', customer_id: CUSTOMER_ID, customer_product_code: 'FG-1', temperature_type: 'FROZEN', product_category: 'Finished Goods' },
    ],
  };
}

async function preview(productCategory = null) {
  vi.resetModules();
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));
  const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');
  const { data, error } = await getBillingPeriodPreview({
    customerId: CUSTOMER_ID, periodStart: '2026-10-01', periodEnd: '2026-10-31', productCategory,
  });
  expect(error).toBeFalsy();
  return data.overtimeLines;
}

describe('getBillingPeriodPreview — pooled OT', () => {
  it('charges the day\'s minimum once across the flagged documents', async () => {
    const lines = await preview();
    expect(lines.map((l) => [l.sourceRequestId, l.amount])).toEqual([['CWR-A', 500], ['CWR-B', 1500]]);
  });

  it('splits the same pool across Raw material / Finished Goods bills without charging the minimum twice', async () => {
    const rm = await preview('Raw material');
    const fg = await preview('Finished Goods');
    expect(rm.map((l) => l.amount)).toEqual([500]);
    expect(fg.map((l) => l.amount)).toEqual([1500]);
  });
});
