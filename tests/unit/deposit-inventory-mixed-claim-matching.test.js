import { describe, expect, it, vi } from 'vitest';

// Real incident this guards against: CWR-20260727-0004 line 3 (tracking
// FR260704036) printed "197 remaining" (2,364.00 kg) when the true
// remaining — matching tgd_get_customer_stock_balance and the live ยอด
// คงเหลือ page — was 45 (540 kg). Root cause: the deposit line's 417 raw
// boxes had claims split across BOTH matching styles — some completed
// withdrawal lines carried source_customer_deposit_request_line_id
// directly, others (against the exact same physical batch) only carried
// tracking_code with the source id left null. getDepositInventoryLines
// used to build two separate totals (by id, by tracking code) and pick
// "whichever bucket is non-empty" via `??`, so a line with a PARTIAL
// id-matched total (195) never fell through to the complete tracking-code
// total (347) — understating the claim by 152 boxes.
//
// Same filter-aware in-memory fake of the supabase query builder used
// elsewhere in this suite, so the test exercises the real matching logic
// rather than a hardcoded return value.

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = col.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);
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
    let rangeVal = null;
    const builder = {
      select: () => builder,
      eq: (col, val) => { filters.push({ type: 'eq', col, val }); return builder; },
      neq: (col, val) => { filters.push({ type: 'neq', col, val }); return builder; },
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      order: () => builder,
      range: (from_, to) => { rangeVal = [from_, to]; return builder; },
      then: (resolve, reject) => {
        let rows = applyFilters(db[table] ?? [], filters);
        if (rangeVal) rows = rows.slice(rangeVal[0], rangeVal[1] + 1);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

const CUSTOMER_ID = 'cust-1';
const DEPOSIT_LINE_ID = 'deposit-line-417';

function makeDb() {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'depreq-1', request_no: 'CDR-x', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-04', reviewed_at: null, last_action_at: null,
      },
    ],
    tgd_customer_deposit_request_lines: [
      {
        id: DEPOSIT_LINE_ID, deposit_request_id: 'depreq-1', line_no: 1,
        customer_product_code: 'RCF024', product_name: 'เศษไก่ BL', lot_no: '182',
        tracking_code: 'FR260704036', mfg_date: null, exp_date: null,
        expected_boxes: 417, expected_weight: 5004, actual_boxes: 417, actual_weight: 5004,
        actual_note: null, uom: 'กล่อง', temperature_type: 'FROZEN', weight_per_box: 12,
      },
    ],
    tgd_customer_withdrawal_request_lines: [
      // Exact match: source id set directly, from a completed OTHER request.
      {
        source_customer_deposit_request_line_id: DEPOSIT_LINE_ID, tracking_code: 'FR260704036',
        requested_boxes: 195, requested_weight: 2340, picked_boxes: 195, picked_weight: 2340,
        withdrawal_request_id: 'wr-a',
        tgd_customer_withdrawal_requests: { status: 'COMPLETED', customer_id: CUSTOMER_ID },
      },
      // Tracking-code-only match against the SAME physical batch — source
      // id left null, a real and equally valid claim against DEPOSIT_LINE_ID.
      {
        source_customer_deposit_request_line_id: null, tracking_code: 'FR260704036',
        requested_boxes: 152, requested_weight: 1824, picked_boxes: 152, picked_weight: 1824,
        withdrawal_request_id: 'wr-b',
        tgd_customer_withdrawal_requests: { status: 'COMPLETED', customer_id: CUSTOMER_ID },
      },
      // The current (excluded) withdrawal request's own claim — must not
      // count as "already claimed by others".
      {
        source_customer_deposit_request_line_id: DEPOSIT_LINE_ID, tracking_code: 'FR260704036',
        requested_boxes: 25, requested_weight: 300, picked_boxes: null, picked_weight: null,
        withdrawal_request_id: 'wr-current',
        tgd_customer_withdrawal_requests: { status: 'SUBMITTED_BY_CUSTOMER', customer_id: CUSTOMER_ID },
      },
    ],
  };
}

describe('getDepositInventoryLines — sums claims split across id-match and tracking-code-match', () => {
  it('adds both matching styles together instead of picking whichever bucket is non-empty', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getDepositInventoryLines } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositInventoryLines({
      customerId: CUSTOMER_ID,
      excludeWithdrawalRequestId: 'wr-current',
    });

    expect(error).toBeFalsy();
    const line = data.find((l) => l.id === DEPOSIT_LINE_ID);
    expect(line).toBeTruthy();
    // 417 raw - (195 exact-match + 152 tracking-code-match) = 70 — NOT 222
    // (417 - 195), which is what the `??`-picks-first-bucket bug produced.
    expect(line.actual_boxes).toBe(70);
    expect(line.actual_weight).toBe(840);
  });
});
