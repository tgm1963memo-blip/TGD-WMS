import { describe, expect, it, vi, beforeEach } from 'vitest';

// The bug this fix addresses: three report pages read a separately-maintained
// per-location ledger table that could silently drift from the live balance
// "ยอดคงเหลือ" computes fresh on every read. This test proves all three now
// source from the exact same underlying data as "ยอดคงเหลือ" and produce
// numbers that agree with each other for the same customer/product — the
// concrete guarantee the fix is supposed to provide, not just "reads a
// different function" as a source-text check.

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

const { getCustomerStorageBalanceRows } = await import('../../src/services/customerStorageBalanceReportService.js');
const { getStorageAgingRows } = await import('../../src/services/storageAgingReportService.js');
const { getDailyStorageWeightPreview } = await import('../../src/services/storageWeightSnapshotService.js');

describe('the 3 report services agree with each other and with the live balance (ยอดคงเหลือ) source', () => {
  beforeEach(() => {
    getAllCustomerStockBalancesMock.mockReset();
    getCustomersMock.mockReset();
    getAllCustomerStockBalancesMock.mockResolvedValue({ data: MOCK_BALANCE_LINES, error: null });
    getCustomersMock.mockResolvedValue({ data: MOCK_CUSTOMERS, error: null });
  });

  it('all three call the same live balance source, not a separate ledger', async () => {
    await getCustomerStorageBalanceRows();
    await getStorageAgingRows();
    await getDailyStorageWeightPreview();

    expect(getAllCustomerStockBalancesMock).toHaveBeenCalledTimes(3);
  });

  it('total boxes/weight for the customer agree across all three reports', async () => {
    const [storageBalance, aging, weightSnapshot] = await Promise.all([
      getCustomerStorageBalanceRows(),
      getStorageAgingRows(),
      getDailyStorageWeightPreview(),
    ]);

    const sumBoxes = (rows) => rows.reduce((s, r) => s + Number(r.qty_boxes ?? 0), 0);
    const sumWeight = (rows) => rows.reduce((s, r) => s + Number(r.qty_weight ?? 0), 0);

    const expectedBoxes = 40 + 10;
    const expectedWeight = 400 + 100;

    expect(sumBoxes(storageBalance.data)).toBe(expectedBoxes);
    expect(sumBoxes(aging.data)).toBe(expectedBoxes);
    expect(sumBoxes(weightSnapshot.data)).toBe(expectedBoxes);

    expect(sumWeight(storageBalance.data)).toBe(expectedWeight);
    expect(sumWeight(aging.data)).toBe(expectedWeight);
    expect(sumWeight(weightSnapshot.data)).toBe(expectedWeight);
  });

  it('resolves the customer name the same way ยอดคงเหลือ does (client-side join against getCustomers)', async () => {
    const { data } = await getCustomerStorageBalanceRows();
    expect(data.every((row) => row.customer_name === 'Alpha Cold Co.')).toBe(true);
  });

  it('propagates a balance-source error to every report instead of silently showing partial/zero data', async () => {
    const boom = new Error('RPC unavailable');
    getAllCustomerStockBalancesMock.mockResolvedValue({ data: null, error: boom });

    const [storageBalance, aging, weightSnapshot] = await Promise.all([
      getCustomerStorageBalanceRows(),
      getStorageAgingRows(),
      getDailyStorageWeightPreview(),
    ]);

    expect(storageBalance.error).toBe(boom);
    expect(aging.error).toBe(boom);
    expect(weightSnapshot.error).toBe(boom);
  });
});
