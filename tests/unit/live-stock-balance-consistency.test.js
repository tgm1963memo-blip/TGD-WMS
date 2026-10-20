import { describe, expect, it, vi, beforeEach } from 'vitest';

// The bug this fix addresses: report pages read a separately-maintained
// per-location ledger table that could silently drift from the live balance
// "ยอดคงเหลือ" computes fresh on every read. This test proves the storage
// aging report (the remaining report built on this source; the customer
// storage balance report and storage weight snapshot were retired) sources
// from the exact same underlying data as "ยอดคงเหลือ" and produces numbers
// that agree with it for the same customer/product.

const { getAllCustomerStockBalancesMock, getCustomersMock } = vi.hoisted(() => ({
  getAllCustomerStockBalancesMock: vi.fn(),
  getCustomersMock: vi.fn(),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  getAllCustomerStockBalances: getAllCustomerStockBalancesMock,
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: getCustomersMock,
}));

const MOCK_CUSTOMERS = [{ id: 'cust-1', customer_code: 'C001', customer_name: 'Alpha Cold Co.' }];

const MOCK_BALANCE_LINES = [
  {
    id: 'dl-1',
    customer_id: 'cust-1',
    customer_product_code: 'RPC060',
    product_name: 'สะโพกหมูตัดแต่งพิเศษ',
    lot_no: '150',
    tracking_code: 'FR260701001',
    temperature_type: 'FROZEN',
    actual_boxes: 40,
    actual_weight: 400,
    mfg_date: '2026-06-01',
    exp_date: '2027-06-01',
    note: null,
    actual_note: null,
    request: { id: 'req-1', request_no: 'CDR-20260701-0001', customer_id: 'cust-1', last_action_at: '2026-07-01T10:00:00Z' },
  },
  {
    id: 'dl-2',
    customer_id: 'cust-1',
    customer_product_code: 'RPC060',
    product_name: 'สะโพกหมูตัดแต่งพิเศษ',
    lot_no: '151',
    tracking_code: 'FR260702001',
    temperature_type: 'FROZEN',
    actual_boxes: 10,
    actual_weight: 100,
    mfg_date: '2026-06-02',
    exp_date: '2027-06-02',
    note: null,
    actual_note: null,
    request: { id: 'req-2', request_no: 'CDR-20260702-0001', customer_id: 'cust-1', last_action_at: '2026-07-02T10:00:00Z' },
  },
];

const { getStorageAgingRows } = await import('../../src/services/storageAgingReportService.js');

describe('the storage aging report agrees with the live balance (ยอดคงเหลือ) source', () => {
  beforeEach(() => {
    getAllCustomerStockBalancesMock.mockReset();
    getCustomersMock.mockReset();
    getAllCustomerStockBalancesMock.mockResolvedValue({ data: MOCK_BALANCE_LINES, error: null });
    getCustomersMock.mockResolvedValue({ data: MOCK_CUSTOMERS, error: null });
  });

  it('calls the live balance source, not a separate ledger', async () => {
    await getStorageAgingRows();

    expect(getAllCustomerStockBalancesMock).toHaveBeenCalledTimes(1);
  });

  it('total boxes/weight for the customer agree with the live balance lines', async () => {
    const aging = await getStorageAgingRows();

    const sumBoxes = (rows) => rows.reduce((s, r) => s + Number(r.qty_boxes ?? 0), 0);
    const sumWeight = (rows) => rows.reduce((s, r) => s + Number(r.qty_weight ?? 0), 0);

    expect(sumBoxes(aging.data)).toBe(40 + 10);
    expect(sumWeight(aging.data)).toBe(400 + 100);
  });

  it('propagates a balance-source error instead of silently showing partial/zero data', async () => {
    const boom = new Error('RPC unavailable');
    getAllCustomerStockBalancesMock.mockResolvedValue({ data: null, error: boom });

    const aging = await getStorageAgingRows();

    expect(aging.error).toBe(boom);
  });
});
