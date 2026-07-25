import { describe, expect, it, vi } from 'vitest';

// Real incident this guards against: CWR-20260725-0006 printed "20 เหลือ /
// 200.00 kg." for tracking FR260716050 (lot API) even though the system's
// live ยอดคงเหลือ was already 0. CWR-20260725-0005, submitted ~50s earlier
// and still WAREHOUSE_PICKING (not yet COMPLETED), had already claimed 20 of
// the deposit line's 84 boxes — but attachRemainingLotBalance used to read
// its baseline from tgd_get_customer_stock_balance, which only nets out
// COMPLETED withdrawals, so 0006's own baseline was still the full 84 and
// never learned about 0005's still-open claim.
//
// This is a thin in-memory fake of the supabase query builder (eq/neq/in
// filter against fixture rows, matching by table name) rather than a mocked
// return value per call, so the test actually exercises the real filter
// arguments listCustomerWithdrawalRequestLines / attachRemainingLotBalance /
// getDepositInventoryLines build — a regression that drops the
// excludeWithdrawalRequestId wiring, or reverts to the COMPLETED-only RPC,
// changes what rows match and fails the assertion below rather than passing
// vacuously.

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
      maybeSingle: () => {
        const rows = applyFilters(db[table] ?? [], filters);
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then: (resolve, reject) => {
        let rows = applyFilters(db[table] ?? [], filters);
        if (rangeVal) rows = rows.slice(rangeVal[0], rangeVal[1] + 1);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  });
  // Default RPC stub returns an empty result so a regression that reverts to
  // calling tgd_get_customer_stock_balance fails on a clean, readable
  // assertion mismatch (lot_remaining_boxes falls back to 0) instead of an
  // unrelated crash from an unstubbed RPC call.
  return { from, rpc: vi.fn(async () => ({ data: [], error: null })) };
}

const CUSTOMER_ID = 'cust-1';
const DEPOSIT_LINE_ID = 'deposit-line-1';
const REQ_0005 = 'req-0005';
const REQ_0006 = 'req-0006';

function makeDb() {
  return {
    tgd_customer_withdrawal_requests: [
      { id: REQ_0006, customer_id: CUSTOMER_ID },
    ],
    tgd_customer_withdrawal_request_lines: [
      {
        id: 'line-0006-1',
        withdrawal_request_id: REQ_0006,
        line_no: 1,
        source_customer_deposit_request_line_id: DEPOSIT_LINE_ID,
        tracking_code: 'FR260716050',
        lot_no: 'API',
        customer_product_code: '3200300000311',
        requested_boxes: 64,
        requested_weight: 640,
        picked_boxes: null,
        picked_weight: null,
        tgd_customer_withdrawal_requests: { status: 'WAREHOUSE_PICKING', customer_id: CUSTOMER_ID },
      },
      // Sibling document, submitted earlier, still open (not COMPLETED, not
      // CANCELLED) — already claimed 20 of the same deposit line's boxes.
      {
        id: 'line-0005-6',
        withdrawal_request_id: REQ_0005,
        line_no: 6,
        source_customer_deposit_request_line_id: DEPOSIT_LINE_ID,
        tracking_code: 'FR260716050',
        lot_no: 'API',
        customer_product_code: '3200300000311',
        requested_boxes: 20,
        requested_weight: 200,
        picked_boxes: null,
        picked_weight: null,
        tgd_customer_withdrawal_requests: { status: 'WAREHOUSE_PICKING', customer_id: CUSTOMER_ID },
      },
    ],
    tgd_customer_deposit_requests: [
      {
        id: 'depreq-1',
        request_no: 'CDR-x',
        customer_id: CUSTOMER_ID,
        status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: null,
        reviewed_at: null,
        last_action_at: null,
        tgd_customer_deposit_request_lines: [
          {
            id: DEPOSIT_LINE_ID,
            lot_no: 'API',
            tracking_code: 'FR260716050',
            customer_product_code: '3200300000311',
            actual_boxes: 84,
            actual_weight: 840,
            expected_boxes: 84,
            expected_weight: 840,
            weight_per_box: 10,
            location_id: null,
            tgd_locations: null,
          },
        ],
      },
    ],
    tgd_customer_deposit_request_lines: [
      {
        id: DEPOSIT_LINE_ID,
        deposit_request_id: 'depreq-1',
        line_no: 1,
        customer_product_code: '3200300000311',
        product_name: 'ไข่รวมเหลว',
        lot_no: 'API',
        tracking_code: 'FR260716050',
        mfg_date: '2026-07-15',
        exp_date: null,
        expected_boxes: 84,
        expected_weight: 840,
        actual_boxes: 84,
        actual_weight: 840,
        actual_note: null,
        uom: 'กล่อง',
        temperature_type: 'FROZEN',
        weight_per_box: 10,
      },
    ],
  };
}

describe('listCustomerWithdrawalRequestLines — remaining balance nets out sibling claims', () => {
  it('subtracts an earlier, still-open sibling withdrawal\'s claim from the printed remaining balance', async () => {
    vi.resetModules();
    const supabaseMock = makeSupabaseMock(makeDb());
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: supabaseMock }));

    const { listCustomerWithdrawalRequestLines } = await import(
      '../../src/services/customerWithdrawalRequestService.js'
    );

    const { data, error } = await listCustomerWithdrawalRequestLines(REQ_0006);

    expect(error).toBeFalsy();
    expect(data).toHaveLength(1);
    // Deposit line has 84 boxes / 840 kg raw. The sibling document (0005)
    // already claims 20/200 and is still open, so 0006's baseline must be
    // 84-20=64 / 840-200=640 — NOT the raw 84/840 a COMPLETED-only baseline
    // would give, and NOT 0/0 (which is what you'd get if 0006's own 64-box
    // line were double-counted into the "other claims" sum instead of being
    // excluded via excludeWithdrawalRequestId).
    expect(data[0].lot_remaining_boxes).toBe(64);
    expect(data[0].lot_remaining_weight).toBe(640);
  });
});
