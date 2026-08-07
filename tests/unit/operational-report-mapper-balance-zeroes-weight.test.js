import { describe, expect, it } from 'vitest';
import { mapMovementLedgerToInventoryReportData } from '../../src/services/operationalReportMapper.js';

// Regression coverage for a real reported bug in the printed "Entry-
// Delivery Inventory Report": a lot's row was marked CLOSED (volume
// balance correctly hit 0 after the last withdrawal) but still showed a
// nonzero คงเหลือ WT(KG) — 0.10kg with 0 boxes left to hold it — because
// the deposit's and withdrawal's independently-weighed totals didn't net
// to exactly zero. Same class of bug as addMovement in
// movementLedgerExcelUtils.js (fixed separately, since this mapper has
// its own independent running-balance implementation): once volume
// balance hits (or drops below) zero, weight must be zeroed too, not
// left as a phantom residual.

const LOT_ROWS = [
  {
    id: 'r1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-30',
    lot_no: '083', tracking_code: 'XX260630135', product_code: 'RPC049',
    qty: 22, weight: 210.00,
  },
  {
    id: 'r2', movement_type: 'DISPATCH', movement_date: '2026-07-14',
    lot_no: '083', tracking_code: 'XX260630135', product_code: 'RPC049',
    qty: 18, weight: 171.90,
  },
  {
    id: 'r3', movement_type: 'DISPATCH', movement_date: '2026-07-15',
    lot_no: '083', tracking_code: 'XX260630135', product_code: 'RPC049',
    qty: 4, weight: 38.00,
  },
];

describe('mapMovementLedgerToInventoryReportData zeroes weight once a lot is fully withdrawn', () => {
  it('marks the depleting row CLOSED with balanceWeight exactly 0, despite deposit/withdrawal weight drift', () => {
    const result = mapMovementLedgerToInventoryReportData({ rows: LOT_ROWS, sortMode: 'productLot' });
    const closingRow = result.lines.find((l) => l.id === 'r3');

    expect(closingRow.balanceVolume).toBe(0);
    expect(closingRow.isClosed).toBe(true);
    expect(closingRow.balanceWeight).toBe(0);
  });

  it('rolls the fix into the grand total balance too', () => {
    const result = mapMovementLedgerToInventoryReportData({ rows: LOT_ROWS, sortMode: 'productLot' });
    expect(result.totalBalanceVolume).toBe(0);
    expect(result.totalBalanceWeight).toBe(0);
  });

  it('still tracks a genuine partial balance normally (volume remains, weight is real)', () => {
    const result = mapMovementLedgerToInventoryReportData({ rows: LOT_ROWS, sortMode: 'productLot' });
    const midRow = result.lines.find((l) => l.id === 'r2');
    expect(midRow.balanceVolume).toBe(4);
    expect(midRow.balanceWeight).toBeCloseTo(38.1, 5);
    expect(midRow.isClosed).toBe(false);
  });
});
