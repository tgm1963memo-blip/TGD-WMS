import { describe, expect, it, vi, beforeEach } from 'vitest';

// The bug this fixes: the stock balance RPC (tgd_get_customer_stock_balance /
// tgd_get_all_customer_stock_balances) sums COALESCE(picked_boxes,
// requested_boxes) for a COMPLETED withdrawal line — a handheld pick can be
// confirmed with only one dimension entered, or (in some completed records)
// neither picked_* filled in at all — see
// supabase/migrations/20260715090000_stock_balance_coalesce_picked_requested.sql.
// The movement ledger report's JS reimplementation of this same balance
// (getAuthoritativeBalanceTotals, getStorageOpeningBalanceRows) and its
// confirmed-withdrawal row builder (getConfirmedWithdrawalRows) summed/
// filtered on bare picked_boxes/picked_weight with no such fallback, so a
// COMPLETED line missing picked_* was undercounted (or dropped outright),
// making the movement ledger report overstate remaining stock relative to
// "ยอดคงเหลือ" for the exact same data.

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

const {
  getAuthoritativeBalanceTotals,
  getConfirmedWithdrawalRows,
  getStorageOpeningBalanceRows,
} = await import('../../src/services/movementLedgerReportService.js');

// A single deposit line that received 100 boxes, and a single COMPLETED
// withdrawal line linked directly to it (source_customer_deposit_request_line_id)
// that was picked with ONLY requested_boxes recorded (picked_boxes null) —
// the exact real-world state the migration comment describes.
const DEPOSIT_ROW = {
  customer_id: 'cust-1',
  tgd_customer_deposit_request_lines: [{
    id: 'dl-1', line_no: 1, lot_no: 'L1', customer_product_code: 'P1', tracking_code: 'TRK-1',
    actual_boxes: 100, actual_weight: 1000, expected_boxes: 100, expected_weight: 1000,
  }],
};

const WITHDRAWAL_ROW = {
  customer_id: 'cust-1', withdrawal_no: 'WDR-1', status: 'COMPLETED',
  last_action_at: '2026-07-01T00:00:00Z', requested_dispatch_date: '2026-07-01',
  tgd_customer_withdrawal_request_lines: [{
    id: 'wl-1', line_no: 1, source_customer_deposit_request_line_id: 'dl-1', tracking_code: null,
    lot_no: 'L1', source_lot_no: null, customer_product_code: 'P1', product_id: null,
    internal_product_code: null, product_name: 'Product 1',
    picked_boxes: null, picked_weight: null,
    requested_boxes: 40, requested_weight: 400,
    picked_at: '2026-07-01T00:00:00Z', picked_by_email: null,
  }],
};

function mockFromFor(table, depositTable = 'tgd_customer_deposit_requests', withdrawalTable = 'tgd_customer_withdrawal_requests') {
  fromMock.mockImplementation((name) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      then: (resolve) => {
        if (name === depositTable) return resolve({ data: [DEPOSIT_ROW], error: null });
        if (name === withdrawalTable) return resolve({ data: [WITHDRAWAL_ROW], error: null });
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  });
}

describe('movement ledger report falls back to requested_boxes/requested_weight like the stock balance RPC', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  // getAuthoritativeBalanceTotals now calls the stock balance RPC directly
  // instead of reimplementing its picked_*/requested_* fallback in JS — the
  // RPC itself already applies that fallback server-side (see
  // supabase/migrations/20260715090000_stock_balance_coalesce_picked_requested.sql).
  // This test feeds a row already shaped the way that RPC would return it
  // (received 100, balance 60 after the requested_* fallback withdrew 40)
  // and asserts the "delivered" figure is correctly derived as
  // received - remaining, not re-summed independently.
  it('getAuthoritativeBalanceTotals derives delivered as received - remaining from the RPC row', async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [{ deposit_line_id: 'dl-1', lot_no: 'L1', tracking_code: 'TRK-1', customer_product_code: 'P1', temperature_type: 'FROZEN', received_boxes: 100, received_weight: 1000, balance_boxes: 60, balance_weight: 600 }],
      error: null,
    });

    const { data, error } = await getAuthoritativeBalanceTotals('cust-1');

    expect(error).toBeNull();
    expect(data.totalBoxes).toBe(60);
    expect(data.totalWeight).toBe(600);
    expect(data.totalDeliveredBoxes).toBe(40);
    expect(data.totalDeliveredWeight).toBe(400);
  });

  it('getConfirmedWithdrawalRows does not drop a COMPLETED line with only requested_* recorded', async () => {
    mockFromFor();
    const { data, error } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].qty).toBe(40);
    expect(data[0].weight).toBe(400);
  });

  it('getStorageOpeningBalanceRows nets the requested_* fallback for lines withdrawn before the cutoff', async () => {
    mockFromFor();
    const depositRowWithDate = {
      ...DEPOSIT_ROW,
      id: 'req-1', request_no: 'CDR-1', expected_arrival_date: '2026-06-01',
      tgd_customer_deposit_request_lines: [{
        ...DEPOSIT_ROW.tgd_customer_deposit_request_lines[0],
        internal_product_code: null, product_id: null, product_name: 'Product 1', temperature_type: 'FROZEN',
      }],
    };
    fromMock.mockImplementation((name) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        then: (resolve) => {
          if (name === 'tgd_customer_deposit_requests') return resolve({ data: [depositRowWithDate], error: null });
          if (name === 'tgd_customer_withdrawal_requests') return resolve({ data: [WITHDRAWAL_ROW], error: null });
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    });

    const { data, error } = await getStorageOpeningBalanceRows('cust-1', '2026-08-01');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // Opening balance as of 2026-08-01 = 100 received - 40 withdrawn (via
    // requested_* fallback, picked before the cutoff) = 60.
    expect(data[0].qty).toBe(60);
    expect(data[0].weight).toBe(600);
  });
});

describe('movement ledger report drops a box-depleted line entirely, matching the RPC WHERE clause', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  // A deposit line whose boxes were fully picked (balance boxes == 0) but
  // whose weight was under-recorded on the withdrawal (balance weight still
  // positive) — the RPC's WHERE GREATEST(0, received_boxes - withdrawn) > 0
  // filters on BOXES only and drops this line's weight too. Summing every
  // line's weight unconditionally (the pre-fix behavior) silently inflated
  // the grand total's weight while boxes still matched exactly, since boxes
  // always contributed 0 either way.
  const zeroBoxDepositRow = {
    customer_id: 'cust-1',
    tgd_customer_deposit_request_lines: [{
      id: 'dl-2', line_no: 1, lot_no: 'L2', customer_product_code: 'P2', tracking_code: 'TRK-2',
      actual_boxes: 10, actual_weight: 100, expected_boxes: 10, expected_weight: 100,
    }],
  };
  const fullyPickedWithdrawalRow = {
    customer_id: 'cust-1', withdrawal_no: 'WDR-2', status: 'COMPLETED',
    last_action_at: '2026-07-01T00:00:00Z', requested_dispatch_date: '2026-07-01',
    tgd_customer_withdrawal_request_lines: [{
      id: 'wl-2', line_no: 1, source_customer_deposit_request_line_id: 'dl-2', tracking_code: null,
      lot_no: 'L2', source_lot_no: null, customer_product_code: 'P2', product_id: null,
      internal_product_code: null, product_name: 'Product 2',
      // All 10 boxes picked, but weight under-recorded at only 60kg — a real
      // completed-with-mismatched-dimensions state.
      picked_boxes: 10, picked_weight: 60,
      requested_boxes: 10, requested_weight: 100,
      picked_at: '2026-07-01T00:00:00Z', picked_by_email: null,
    }],
  };

  // The RPC's own `WHERE GREATEST(0, received_boxes - withdrawn_boxes) > 0`
  // clause (see the migration referenced above) already drops a box-depleted
  // line from its result set entirely, weight included — this function never
  // sees such a row at all, so it can't leak its leftover weight balance
  // into the total the way the old JS reimplementation once did.
  it('getAuthoritativeBalanceTotals totals 0 when the RPC has already excluded a box-depleted line', async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { data, error } = await getAuthoritativeBalanceTotals('cust-1');

    expect(error).toBeNull();
    expect(data.totalBoxes).toBe(0);
    expect(data.totalWeight).toBe(0);
  });
});
