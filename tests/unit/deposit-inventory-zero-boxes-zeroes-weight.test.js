import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a real reported bug (in the Movement Ledger,
// fixed the same way here since getDepositInventoryLines has its own
// independent copy of the same arithmetic): a deposit line's actual_boxes
// and actual_weight are the receiving-time weighing; a withdrawal's
// picked_boxes/picked_weight come from an independent scale reading at
// pick time. Even when every box has been claimed (boxes floor to 0),
// the two weighings rarely net to exactly zero — this used to leave a
// phantom "0 boxes but 0.5kg available" on a fully-claimed deposit line,
// which reads as a data error to a customer checking balance before
// creating a new withdrawal request.

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
const DEPOSIT_LINE_ID = 'deposit-line-1';

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
        customer_product_code: 'RPC039', product_name: 'มันหมูตัดแต่ง', lot_no: '131',
        tracking_code: 'XX260630131', mfg_date: null, exp_date: null,
        expected_boxes: 32, expected_weight: 317.79, actual_boxes: 32, actual_weight: 317.79,
        actual_note: null, uom: 'กล่อง', temperature_type: 'FROZEN', weight_per_box: 9.93,
      },
    ],
    tgd_customer_withdrawal_request_lines: [
      // Fully claims all 32 boxes, but picked_weight (independent scale
      // reading at pick time) is 0.01kg less than the deposit's own
      // weighing — the exact drift shape from the real reported rows.
      {
        source_customer_deposit_request_line_id: DEPOSIT_LINE_ID, tracking_code: 'XX260630131',
        requested_boxes: 32, requested_weight: 317.78, picked_boxes: 32, picked_weight: 317.78,
        withdrawal_request_id: 'wr-a',
        tgd_customer_withdrawal_requests: { status: 'COMPLETED', customer_id: CUSTOMER_ID },
      },
    ],
  };
}

describe('getDepositInventoryLines zeroes actual_weight once actual_boxes is fully claimed', () => {
  it('reports 0 boxes AND 0 weight, not a phantom weight-drift residual', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getDepositInventoryLines } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositInventoryLines({ customerId: CUSTOMER_ID });

    expect(error).toBeFalsy();
    const line = data.find((l) => l.id === DEPOSIT_LINE_ID);
    expect(line).toBeTruthy();
    expect(line.actual_boxes).toBe(0);
    expect(line.actual_weight).toBe(0);
  });
});
