import { describe, expect, it, vi, beforeEach } from 'vitest';

// The bug this fixes: the movement ledger report classified a deposit/
// withdrawal row's reporting date by the customer's PLANNING date
// (expected_arrival_date / requested_dispatch_date) first, falling back to
// last_action_at only when the planning date was absent. The stock balance
// RPC (tgd_get_customer_stock_balance / tgd_get_all_customer_stock_balances,
// supabase/migrations/20260801130000_fix_as_of_date_missing_timeline_events.sql)
// does the opposite: it prefers the document's actual RECEIVED_CONFIRMED/
// COMPLETED status-transition timestamp from
// tgd_customer_document_timeline_events, and only falls back to
// last_action_at/expected_arrival_date when NO such event exists at all.
// A document planned on/before a cutoff date but not actually confirmed
// until after it was therefore wrongly included by the ledger and correctly
// excluded by the RPC — a real, confirmed gap (+1,176 boxes / +10,868.67 kg
// on a 2026-08-18 comparison). resolveDocumentConfirmedDates fixes this by
// giving the ledger the exact same date-resolution priority as the RPC.

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

const {
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  getAuthoritativeBalanceTotals,
  resolveDocumentConfirmedDates,
} = await import('../../src/services/movementLedgerReportService.js');

const CUTOFF = '2026-08-18';

// Planned to arrive on 2026-08-10 (before the cutoff) but not actually
// confirmed received until 2026-08-19 (after the cutoff) — the exact
// real-world pattern that caused the reported bug.
const LATE_CONFIRMED_DEPOSIT = {
  id: 'dep-late-1',
  request_no: 'CDR-LATE-1',
  customer_id: 'cust-1',
  status: 'RECEIVED_CONFIRMED',
  expected_arrival_date: '2026-08-10',
  last_action_at: '2026-08-19T09:00:00Z',
  tgd_customer_deposit_request_lines: [{
    id: 'dl-late-1', line_no: 1, product_id: null, customer_product_code: 'P1',
    internal_product_code: null, product_name: 'Product 1', lot_no: 'L1',
    actual_boxes: 50, actual_weight: 500, expected_boxes: 50, expected_weight: 500,
    location_id: null, temperature_type: 'FROZEN', tracking_code: 'TRK-LATE-1',
  }],
};

// No timeline event at all for this one — legacy/migrated data — must still
// fall back to last_action_at/expected_arrival_date like before.
const NO_EVENT_DEPOSIT = {
  id: 'dep-legacy-1',
  request_no: 'CDR-LEGACY-1',
  customer_id: 'cust-1',
  status: 'RECEIVED_CONFIRMED',
  expected_arrival_date: '2026-08-05',
  last_action_at: '2026-08-05T09:00:00Z',
  tgd_customer_deposit_request_lines: [{
    id: 'dl-legacy-1', line_no: 1, product_id: null, customer_product_code: 'P2',
    internal_product_code: null, product_name: 'Product 2', lot_no: 'L2',
    actual_boxes: 20, actual_weight: 200, expected_boxes: 20, expected_weight: 200,
    location_id: null, temperature_type: 'FROZEN', tracking_code: 'TRK-LEGACY-1',
  }],
};

const LATE_COMPLETED_WITHDRAWAL = {
  id: 'wdr-late-1',
  withdrawal_no: 'CWR-LATE-1',
  customer_id: 'cust-1',
  status: 'COMPLETED',
  requested_dispatch_date: '2026-08-10',
  last_action_at: '2026-08-19T09:00:00Z',
  tgd_customer_withdrawal_request_lines: [{
    id: 'wl-late-1', line_no: 1, customer_product_code: 'P1', internal_product_code: null,
    product_name: 'Product 1', lot_no: 'L1', product_id: null,
    source_customer_deposit_request_id: null, source_lot_no: null,
    requested_boxes: 5, requested_weight: 50,
    picked_boxes: 5, picked_weight: 50, picked_at: '2026-08-19T09:00:00Z', picked_by_email: null,
    tracking_code: 'TRK-LATE-1',
  }],
};

function makeChain(handlers) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    then: (resolve) => resolve(handlers.result),
  };
  return chain;
}

// timelineEvents: [{ document_id, created_at }]
function mockFromWithTimeline({ depositRows = [], withdrawalRows = [], timelineEvents = [] } = {}) {
  fromMock.mockImplementation((name) => {
    if (name === 'tgd_customer_deposit_requests') return makeChain({ result: { data: depositRows, error: null } });
    if (name === 'tgd_customer_withdrawal_requests') return makeChain({ result: { data: withdrawalRows, error: null } });
    if (name === 'tgd_customer_document_timeline_events') return makeChain({ result: { data: timelineEvents, error: null } });
    return makeChain({ result: { data: [], error: null } });
  });
}

describe('resolveDocumentConfirmedDates', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('prefers the timeline event date over the fallback date', async () => {
    mockFromWithTimeline({
      timelineEvents: [{ document_id: 'doc-1', created_at: '2026-08-19T09:00:00Z' }],
    });
    const result = await resolveDocumentConfirmedDates(
      [{ id: 'doc-1', fallbackDate: '2026-08-10' }],
      'CUSTOMER_DEPOSIT_REQUEST',
      'RECEIVED_CONFIRMED',
    );
    expect(result.get('doc-1')).toBe('2026-08-19');
  });

  it('falls back to the supplied fallback date when no event exists', async () => {
    mockFromWithTimeline({ timelineEvents: [] });
    const result = await resolveDocumentConfirmedDates(
      [{ id: 'doc-2', fallbackDate: '2026-08-05' }],
      'CUSTOMER_DEPOSIT_REQUEST',
      'RECEIVED_CONFIRMED',
    );
    expect(result.get('doc-2')).toBe('2026-08-05');
  });

  it('uses the earliest event when multiple events match the same status', async () => {
    mockFromWithTimeline({
      timelineEvents: [
        { document_id: 'doc-3', created_at: '2026-08-20T09:00:00Z' },
        { document_id: 'doc-3', created_at: '2026-08-12T09:00:00Z' },
      ],
    });
    const result = await resolveDocumentConfirmedDates(
      [{ id: 'doc-3', fallbackDate: '2026-08-01' }],
      'CUSTOMER_DEPOSIT_REQUEST',
      'RECEIVED_CONFIRMED',
    );
    expect(result.get('doc-3')).toBe('2026-08-12');
  });
});

describe('getConfirmedDepositReceiptRows uses the actual confirmation date, not the planning date', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('excludes a deposit planned before the cutoff but confirmed after it', async () => {
    mockFromWithTimeline({
      depositRows: [LATE_CONFIRMED_DEPOSIT],
      timelineEvents: [{ document_id: 'dep-late-1', created_at: '2026-08-19T09:00:00Z' }],
    });

    const { data, error } = await getConfirmedDepositReceiptRows({ dateTo: CUTOFF });

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('includes the same deposit when the cutoff extends past the real confirmation date', async () => {
    mockFromWithTimeline({
      depositRows: [LATE_CONFIRMED_DEPOSIT],
      timelineEvents: [{ document_id: 'dep-late-1', created_at: '2026-08-19T09:00:00Z' }],
    });

    const { data, error } = await getConfirmedDepositReceiptRows({ dateTo: '2026-08-19' });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].movement_date).toBe('2026-08-19');
  });

  it('falls back to last_action_at/expected_arrival_date when no timeline event exists', async () => {
    mockFromWithTimeline({ depositRows: [NO_EVENT_DEPOSIT], timelineEvents: [] });

    const { data, error } = await getConfirmedDepositReceiptRows({ dateTo: CUTOFF });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].movement_date).toBe('2026-08-05');
  });
});

describe('getConfirmedWithdrawalRows uses the actual completion date, not the planning date', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('excludes a withdrawal planned before the cutoff but completed after it', async () => {
    mockFromWithTimeline({
      withdrawalRows: [LATE_COMPLETED_WITHDRAWAL],
      timelineEvents: [{ document_id: 'wdr-late-1', created_at: '2026-08-19T09:00:00Z' }],
    });

    const { data, error } = await getConfirmedWithdrawalRows({ dateTo: CUTOFF });

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

// getAuthoritativeBalanceTotals now calls the real stock-balance RPC
// directly (tgd_get_customer_stock_balance / tgd_get_all_customer_stock_
// balances) instead of reimplementing the FIFO/exact-match algorithm a
// second time in JS from raw deposit/withdrawal rows — that reimplementation
// could only ever produce one customer-wide, all-temperature/all-product
// total, which is why the report used to disable it (falling back to a
// lot_no-grouped approximation) whenever any filter was active. That
// fallback is PROVABLY WRONG whenever a lot spans multiple deposit lines/
// tracking codes — confirmed real gap: OVO/FROZEN on 2026-08-20 showed
// 34,172 boxes via the lot_no fallback vs. the RPC's correct 33,872. These
// tests mock supabase.rpc(...) directly and assert rowFilters narrows the
// RPC's own rows client-side, matching the balance page's own filtering.
describe('getAuthoritativeBalanceTotals(customerId, asOfDate, rowFilters) — calls the real RPC directly', () => {
  const RPC_ROWS = [
    { deposit_line_id: 'dl-a', lot_no: 'LOT-1', tracking_code: 'TRK-A', customer_product_code: 'P1', temperature_type: 'FROZEN', received_boxes: 100, received_weight: 1000, balance_boxes: 40, balance_weight: 400 },
    // Same lot_no as dl-a but a DIFFERENT tracking code/deposit line — the
    // exact real-world case a lot_no-only grouping can't replicate, but the
    // RPC (and therefore this filter) handles correctly per deposit line.
    { deposit_line_id: 'dl-b', lot_no: 'LOT-1', tracking_code: 'TRK-B', customer_product_code: 'P1', temperature_type: 'FROZEN', received_boxes: 50, received_weight: 500, balance_boxes: 20, balance_weight: 200 },
    { deposit_line_id: 'dl-c', lot_no: 'LOT-2', tracking_code: 'TRK-C', customer_product_code: 'P2', temperature_type: 'CHILLED', received_boxes: 30, received_weight: 300, balance_boxes: 30, balance_weight: 300 },
  ];

  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('calls tgd_get_customer_stock_balance with customerId + asOfDate and sums all rows when no filter is given', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    const { data, error } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20');

    expect(rpcMock).toHaveBeenCalledWith('tgd_get_customer_stock_balance', { p_customer_id: 'cust-1', p_as_of_date: '2026-08-20' });
    expect(error).toBeNull();
    expect(data.totalBoxes).toBe(90);
    expect(data.totalWeight).toBe(900);
  });

  it('calls tgd_get_all_customer_stock_balances when customerId is omitted', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    await getAuthoritativeBalanceTotals(null, '2026-08-20');

    expect(rpcMock).toHaveBeenCalledWith('tgd_get_all_customer_stock_balances', { p_as_of_date: '2026-08-20' });
  });

  it('filters by temperatureType — the exact OVO/FROZEN/2026-08-20 scenario, matches the balance page even though a lot spans multiple tracking codes', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    const { data, error } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20', { temperatureType: 'FROZEN' });

    expect(error).toBeNull();
    expect(data.totalBoxes).toBe(60); // dl-a (40) + dl-b (20), NOT the wrong lot_no-fallback total
    expect(data.totalWeight).toBe(600);
  });

  it('filters by lotNo, summing across every deposit line/tracking code that shares the lot', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    const { data } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20', { lotNo: 'LOT-1' });

    expect(data.totalBoxes).toBe(60);
    expect(data.totalWeight).toBe(600);
  });

  it('filters by trackingCode down to a single deposit line', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    const { data } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20', { trackingCode: 'TRK-B' });

    expect(data.totalBoxes).toBe(20);
    expect(data.totalWeight).toBe(200);
  });

  it('filters by customerProductCode', async () => {
    rpcMock.mockResolvedValue({ data: RPC_ROWS, error: null });

    const { data } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20', { customerProductCode: 'P2' });

    expect(data.totalBoxes).toBe(30);
    expect(data.totalWeight).toBe(300);
  });

  it('propagates an RPC error instead of returning a fabricated total', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const { data, error } = await getAuthoritativeBalanceTotals('cust-1', '2026-08-20');

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});
