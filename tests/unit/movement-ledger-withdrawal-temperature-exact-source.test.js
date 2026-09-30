import { describe, expect, it, vi, beforeEach } from 'vitest';

// Regression: CH260918002 (CHILLED) was withdrawn on CWR-20260922-0008 but
// showed as FROZEN in the movement ledger. The withdrawal line had no
// source request id and a lot that didn't match, so the resolver fell back
// to "first deposit line with the same product code" -- a FROZEN FR line.
// It now uses the withdrawal line's own temperature, then its exact source
// line (line id or tracking code), before any heuristic.

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: { from: fromMock } }));

const { getConfirmedWithdrawalRows } = await import('../../src/services/movementLedgerReportService.js');

const DEPOSIT_ROW = {
  id: 'req-dep-1', customer_id: 'cust-1', status: 'RECEIVED_CONFIRMED',
  tgd_customer_deposit_request_lines: [
    // Listed first on purpose: the old product-code fallback picked this one.
    { id: 'dl-frozen', deposit_request_id: 'req-dep-1', lot_no: 'A2-04262130', customer_product_code: '3200200000420', product_id: null, temperature_type: 'FROZEN', location_id: 'loc-F', tracking_code: 'FR260701120' },
    { id: 'dl-chilled', deposit_request_id: 'req-dep-1', lot_no: '11/9/26', customer_product_code: '3200200000420', product_id: null, temperature_type: 'CHILLED', location_id: 'loc-C', tracking_code: 'CH260918002' },
  ],
};

function withdrawalLine(overrides) {
  return {
    id: 'wl-1', line_no: 1, source_customer_deposit_request_id: null, source_customer_deposit_request_line_id: null,
    tracking_code: 'CH260918002', lot_no: 'no-match', source_lot_no: null, customer_product_code: '3200200000420',
    product_id: null, internal_product_code: null, product_name: 'ไข่แดงผสมเกลือ10%', temperature_type: null,
    picked_boxes: 1, picked_weight: 10, requested_boxes: 1, requested_weight: 10,
    picked_at: '2026-09-22T00:00:00Z', picked_by_email: null,
    ...overrides,
  };
}

function mockFrom(line) {
  fromMock.mockImplementation((name) => {
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), neq: vi.fn(() => chain), in: vi.fn(() => chain), ilike: vi.fn(() => chain), order: vi.fn(() => chain), range: vi.fn(() => chain),
      then: (resolve) => {
        if (name === 'tgd_customer_deposit_requests') return resolve({ data: [DEPOSIT_ROW], error: null });
        if (name === 'tgd_customer_withdrawal_requests') {
          return resolve({ data: [{ id: 'wr-1', customer_id: 'cust-1', withdrawal_no: 'CWR-20260922-0008', status: 'COMPLETED', last_action_at: '2026-09-22T00:00:00Z', requested_dispatch_date: '2026-09-22', tgd_customer_withdrawal_request_lines: [line] }], error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  });
}

describe('movement ledger withdrawal temperature uses the exact source line', () => {
  beforeEach(() => fromMock.mockReset());

  it('matches by tracking code instead of the first line of the same product', async () => {
    mockFrom(withdrawalLine({}));
    const { data } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });
    expect(data[0].temperature_type).toBe('CHILLED');
    expect(data[0].location_id).toBe('loc-C');
  });

  it('matches by source line id', async () => {
    mockFrom(withdrawalLine({ tracking_code: null, source_customer_deposit_request_line_id: 'dl-chilled' }));
    const { data } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });
    expect(data[0].temperature_type).toBe('CHILLED');
  });

  it('prefers the withdrawal line\'s own temperature when an admin set it', async () => {
    mockFrom(withdrawalLine({ temperature_type: 'FREEZE_FROZEN' }));
    const { data } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });
    expect(data[0].temperature_type).toBe('FREEZE_FROZEN');
  });
});
