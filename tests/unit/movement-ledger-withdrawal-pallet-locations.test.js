import { describe, expect, it, vi, beforeEach } from 'vitest';

// Regression coverage for the pallet-split model: a withdrawal line picked
// from multiple pallets (possibly across multiple locations) must show all
// of them on the Movement Ledger report, not just one guessed via the old
// A/B/C heuristic match against the source deposit line. See
// resolveWithdrawalLinePalletLocations in movementLedgerReportService.js.

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock },
}));

const { getConfirmedWithdrawalRows } = await import('../../src/services/movementLedgerReportService.js');

const WITHDRAWAL_ROW = {
  customer_id: 'cust-1', withdrawal_no: 'WDR-1', status: 'COMPLETED',
  last_action_at: '2026-08-01T00:00:00Z', requested_dispatch_date: '2026-08-01',
  tgd_customer_withdrawal_request_lines: [{
    id: 'wl-1', line_no: 1, source_customer_deposit_request_id: null, tracking_code: 'TRK-1',
    lot_no: 'L1', source_lot_no: null, customer_product_code: 'P1', product_id: null,
    internal_product_code: null, product_name: 'Product 1',
    picked_boxes: 8, picked_weight: 80, requested_boxes: 8, requested_weight: 80,
    picked_at: '2026-08-01T00:00:00Z', picked_by_email: null,
  }],
};

const PICK_ROWS = [
  {
    withdrawal_line_id: 'wl-1',
    tgd_customer_deposit_line_locations: { location_id: 'loc-A', pallet_no: 1, tgd_locations: { location_code: '42-L-01' } },
  },
  {
    withdrawal_line_id: 'wl-1',
    tgd_customer_deposit_line_locations: { location_id: 'loc-B', pallet_no: 3, tgd_locations: { location_code: '42-L-02' } },
  },
];

function mockFrom() {
  fromMock.mockImplementation((name) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      then: (resolve) => {
        if (name === 'tgd_customer_withdrawal_requests') return resolve({ data: [WITHDRAWAL_ROW], error: null });
        if (name === 'tgd_customer_withdrawal_line_pallet_picks') return resolve({ data: PICK_ROWS, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  });
}

describe('getConfirmedWithdrawalRows resolves multiple pallet locations', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('joins every pallet code the line was picked from into location_name, and uses the first as location_id', async () => {
    mockFrom();
    const { data, error } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].location_id).toBe('loc-A');
    expect(data[0].location_name).toBe('42-L-01-01, 42-L-02-03');
  });
});
