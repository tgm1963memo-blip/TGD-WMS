import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a real reported bug: a customer with 89
// confirmed deposit requests had 1,095 deposit lines in total. All 89 ids
// fit in a single chunk (chunk size 150), so getDepositInventoryLines
// asked for them in one unpaginated `.in('deposit_request_id', ids)`
// call — PostgREST silently caps any request with no explicit `.range()`
// at 1000 rows, so the ~95 lines past that cut vanished from every
// withdrawal-creation balance/autocomplete lookup with no error at all.
// Three specific tracking codes (FR260630036/037/038) landed past the
// cut and showed "ไม่พบข้อมูล" despite having a genuine, untouched
// deposit balance. This mock enforces the same real default-cap
// behavior PostgREST has (return at most 1000 rows unless `.range()` is
// explicitly set) so this test fails against the old unpaginated code
// and passes against the fix, which pages through with `.range()` until
// a page comes back short.
//
// The mock also honors `.order()` (applying each chained call as a
// successive sort key, like Postgres does) so a regression that drops
// line_no as the primary sort — several callers (getMatchedDepositLine's
// tie-break, CustomerWithdrawalLinesTable's dropdown/auto-fill "first
// match" logic) depend on this array's order, not just its contents — is
// caught here too, not just the row count.

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

function applyOrder(rows, orderKeys) {
  if (!orderKeys.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, ascending } of orderKeys) {
      const av = col.split('.').reduce((o, k) => (o == null ? undefined : o[k]), a);
      const bv = col.split('.').reduce((o, k) => (o == null ? undefined : o[k]), b);
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return ascending ? cmp : -cmp;
    }
    return 0;
  });
}

const DEFAULT_POSTGREST_ROW_CAP = 1000;

function makeSupabaseMock(db) {
  const from = vi.fn((table) => {
    const filters = [];
    const orderKeys = [];
    let rangeVal = null;
    const builder = {
      select: () => builder,
      eq: (col, val) => { filters.push({ type: 'eq', col, val }); return builder; },
      neq: (col, val) => { filters.push({ type: 'neq', col, val }); return builder; },
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      order: (col, opts) => { orderKeys.push({ col, ascending: opts?.ascending !== false }); return builder; },
      range: (from_, to) => { rangeVal = [from_, to]; return builder; },
      then: (resolve, reject) => {
        let rows = applyOrder(applyFilters(db[table] ?? [], filters), orderKeys);
        if (rangeVal) {
          rows = rows.slice(rangeVal[0], rangeVal[1] + 1);
        } else if (rows.length > DEFAULT_POSTGREST_ROW_CAP) {
          rows = rows.slice(0, DEFAULT_POSTGREST_ROW_CAP);
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

const CUSTOMER_ID = 'cust-1';

describe('getDepositInventoryLines pages through more than 1000 deposit lines', () => {
  const TOTAL_LINES = 1095;
  // Positioned past row 1000 by id order, mirroring FR260630036/037/038's
  // real position in the truncated 1000-row page.
  const MISSING_LINE_INDEXES = [1050, 1051, 1052];

  function makeDb() {
    const lines = Array.from({ length: TOTAL_LINES }, (_, i) => ({
      id: `line-${String(i).padStart(5, '0')}`,
      deposit_request_id: 'depreq-1',
      // Every id shares line_no 1 except a few high-line_no lines placed
      // first by id — if the query's primary sort were id (not line_no),
      // these would sort before line_no-1 rows; asserted against below.
      line_no: i < 5 ? 99 : 1,
      customer_product_code: '10154-10',
      product_name: 'สโมคเบค่อน TGM',
      lot_no: `lot-${i}`,
      tracking_code: MISSING_LINE_INDEXES.includes(i) ? `FR26063003${6 + MISSING_LINE_INDEXES.indexOf(i)}` : `OTHER-${i}`,
      mfg_date: null,
      exp_date: null,
      expected_boxes: 200,
      expected_weight: 1000,
      actual_boxes: 200,
      actual_weight: 1000,
      actual_note: null,
      uom: 'กล่อง',
      temperature_type: 'FROZEN',
      weight_per_box: 5,
    }));

    return {
      tgd_customer_deposit_requests: [
        {
          id: 'depreq-1', request_no: 'OB-20260630-042523', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
          expected_arrival_date: null, reviewed_at: null, last_action_at: null,
        },
      ],
      tgd_customer_deposit_request_lines: lines,
      tgd_customer_withdrawal_request_lines: [],
    };
  }

  it('does not silently drop lines past the 1000-row default cap', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getDepositInventoryLines } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositInventoryLines({ customerId: CUSTOMER_ID });

    expect(error).toBeFalsy();
    expect(data.length).toBe(TOTAL_LINES);

    for (let i = 0; i < MISSING_LINE_INDEXES.length; i += 1) {
      const trackingCode = `FR26063003${6 + i}`;
      expect(data.some((l) => l.tracking_code === trackingCode)).toBe(true);
    }
  });

  it('keeps line_no as the primary sort (id only breaks ties within a line_no)', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getDepositInventoryLines } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositInventoryLines({ customerId: CUSTOMER_ID });

    expect(error).toBeFalsy();
    // The 5 line_no=99 rows have the lexicographically smallest ids
    // (line-00000..line-00004) — if id were the primary sort they'd lead
    // the array; with line_no primary they must sort last.
    const lineNos = data.map((l) => l.line_no);
    expect(lineNos.slice(0, TOTAL_LINES - 5)).toEqual(Array(TOTAL_LINES - 5).fill(1));
    expect(lineNos.slice(TOTAL_LINES - 5)).toEqual(Array(5).fill(99));
  });
});

describe('getDepositInventoryLines pages through more than 1000 claimed withdrawal lines', () => {
  const DEPOSIT_LINE_ID = 'deposit-line-1';
  const TOTAL_CLAIM_LINES = 1002;

  function makeDb() {
    // A single deposit line with a large balance, claimed down to exactly
    // 1 box remaining by 1,002 separate non-cancelled withdrawal lines —
    // the LAST claim (highest id, landing on the second page) is what
    // makes the difference between "1 box available" and "3 boxes
    // available". If that page were silently dropped, the balance below
    // would overstate what's actually left.
    const claims = Array.from({ length: TOTAL_CLAIM_LINES }, (_, i) => ({
      id: `claim-${String(i).padStart(5, '0')}`,
      source_customer_deposit_request_line_id: DEPOSIT_LINE_ID,
      tracking_code: null,
      requested_boxes: 1,
      requested_weight: 5,
      picked_boxes: 1,
      picked_weight: 5,
      withdrawal_request_id: `wr-${i}`,
      tgd_customer_withdrawal_requests: { status: 'COMPLETED', customer_id: CUSTOMER_ID, withdrawal_no: `CWR-${i}` },
    }));

    return {
      tgd_customer_deposit_requests: [
        {
          id: 'depreq-1', request_no: 'CDR-x', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
          expected_arrival_date: null, reviewed_at: null, last_action_at: null,
        },
      ],
      tgd_customer_deposit_request_lines: [
        {
          id: DEPOSIT_LINE_ID, deposit_request_id: 'depreq-1', line_no: 1,
          customer_product_code: 'RPC039', product_name: 'มันหมูตัดแต่ง', lot_no: '131',
          tracking_code: 'XX-BIG-LOT', mfg_date: null, exp_date: null,
          expected_boxes: TOTAL_CLAIM_LINES + 1, expected_weight: (TOTAL_CLAIM_LINES + 1) * 5,
          actual_boxes: TOTAL_CLAIM_LINES + 1, actual_weight: (TOTAL_CLAIM_LINES + 1) * 5,
          actual_note: null, uom: 'กล่อง', temperature_type: 'FROZEN', weight_per_box: 5,
        },
      ],
      tgd_customer_withdrawal_request_lines: claims,
    };
  }

  it('nets every claim against the deposit balance, not just the first 1000', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getDepositInventoryLines } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositInventoryLines({ customerId: CUSTOMER_ID });

    expect(error).toBeFalsy();
    const line = data.find((l) => l.id === DEPOSIT_LINE_ID);
    expect(line).toBeTruthy();
    expect(line.actual_boxes).toBe(1);
    expect(line.actual_weight).toBe(5);
  });
});
