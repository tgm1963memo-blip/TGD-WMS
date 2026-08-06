import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Regression: tgd_customer_withdrawal_request_lines has NO location_id
// column (unlike tgd_customer_deposit_request_lines, which does) — a prior
// change selected it anyway, which made the whole Postgres query for
// getConfirmedWithdrawalRows fail with "column ... does not exist" on
// every call, for every customer/date range. That error was then silently
// swallowed (fetchMergedRows in MovementLedgerReportPage.jsx only ever
// surfaced the stock_movements source's error), so the Movement Ledger
// report just rendered "no data found" for withdrawals/dispatches with no
// indication anything was broken. Fixed by resolving location_id from the
// source deposit line instead (same A/B/C match already used for
// temperature_type), and by no longer swallowing a deposit/withdrawal
// query error in the page.

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const servicePath = 'src/services/movementLedgerReportService.js';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('getConfirmedWithdrawalRows no longer selects a non-existent column', () => {
  it('does not select location_id directly off tgd_customer_withdrawal_request_lines', () => {
    const source = readProjectFile(servicePath);
    const withdrawalSelectMatch = source.match(
      /getConfirmedWithdrawalRows[\s\S]*?tgd_customer_withdrawal_requests[\s\S]*?\$\{lineRelation\}\(([\s\S]*?)\)/,
    );
    expect(withdrawalSelectMatch).not.toBeNull();
    expect(withdrawalSelectMatch[1]).not.toContain('location_id');
  });

  it('still selects location_id on the deposit-lines relation, where the column really exists', () => {
    const source = readProjectFile(servicePath);
    const depositSelectMatch = source.match(
      /getConfirmedDepositReceiptRows[\s\S]*?tgd_customer_deposit_requests[\s\S]*?\$\{lineRelation\}\(([\s\S]*?)\)/,
    );
    expect(depositSelectMatch).not.toBeNull();
    expect(depositSelectMatch[1]).toContain('location_id');
  });
});

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: fromMock },
}));

const { getConfirmedWithdrawalRows } = await import('../../src/services/movementLedgerReportService.js');

const DEPOSIT_ROW = {
  id: 'req-dep-1', customer_id: 'cust-1', status: 'RECEIVED_CONFIRMED',
  tgd_customer_deposit_request_lines: [{
    id: 'dl-1', deposit_request_id: 'req-dep-1', lot_no: 'L1', customer_product_code: 'P1',
    product_id: null, temperature_type: 'FROZEN', location_id: 'loc-A',
  }],
};

const WITHDRAWAL_ROW = {
  customer_id: 'cust-1', withdrawal_no: 'WDR-1', status: 'COMPLETED',
  last_action_at: '2026-08-01T00:00:00Z', requested_dispatch_date: '2026-08-01',
  tgd_customer_withdrawal_request_lines: [{
    id: 'wl-1', line_no: 1, source_customer_deposit_request_id: 'req-dep-1', tracking_code: null,
    lot_no: 'L1', source_lot_no: null, customer_product_code: 'P1', product_id: null,
    internal_product_code: null, product_name: 'Product 1',
    picked_boxes: 5, picked_weight: 50, requested_boxes: 5, requested_weight: 50,
    picked_at: '2026-08-01T00:00:00Z', picked_by_email: null,
  }],
};

function mockFrom({ withdrawalError = null } = {}) {
  fromMock.mockImplementation((name) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      then: (resolve) => {
        if (name === 'tgd_customer_deposit_requests') return resolve({ data: [DEPOSIT_ROW], error: null });
        if (name === 'tgd_customer_withdrawal_requests') {
          return resolve(withdrawalError ? { data: null, error: withdrawalError } : { data: [WITHDRAWAL_ROW], error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  });
}

describe('getConfirmedWithdrawalRows resolves location from the source deposit line', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('attaches the source deposit line\'s location_id to the withdrawal row', async () => {
    mockFrom();
    const { data, error } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].location_id).toBe('loc-A');
  });

  it('propagates a query error instead of silently returning an empty list', async () => {
    const dbError = new Error('column tgd_customer_withdrawal_request_lines_1.location_id does not exist');
    mockFrom({ withdrawalError: dbError });
    const { data, error } = await getConfirmedWithdrawalRows({ customerId: 'cust-1' });

    expect(error).toBe(dbError);
    expect(data).toEqual([]);
  });
});
