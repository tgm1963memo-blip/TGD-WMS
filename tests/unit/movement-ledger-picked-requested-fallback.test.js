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

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock },
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

  it('getAuthoritativeBalanceTotals nets the requested_* fallback against the deposit line', async () => {
    mockFromFor();
    const { data, error } = await getAuthoritativeBalanceTotals('cust-1');

    expect(error).toBeNull();
    // received 100 - withdrawn 40 (from requested_boxes fallback) = 60
    expect(data.totalBoxes).toBe(60);
    expect(data.totalWeight).toBe(600);
    // "delivered" is derived as received - remaining, so it reflects the
    // requested_* fallback too, not zero.
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
