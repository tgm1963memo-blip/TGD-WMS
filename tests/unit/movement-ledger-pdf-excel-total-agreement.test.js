import { describe, expect, it } from 'vitest';
import { mapMovementLedgerToInventoryReportData } from '../../src/services/operationalReportMapper.js';
import { buildMovementLedgerExcelRows } from '../../src/utils/movementLedgerExcelUtils.js';

// Regression coverage for a real reported bug: the printed PDF report's
// grand TOTAL คงเหลือ(น้ำหนัก) and the Excel export's TOTAL row disagreed
// by exactly the sum of several fully-withdrawn lots' weight-drift
// residuals (0.01 + 1.00 + 18.69 + 0.10 = 19.80kg) — because each report
// replays the running balance with its own independent implementation.
// Both are now fixed to zero weight once a lot's box balance hits zero
// (see addMovement in movementLedgerExcelUtils.js and the matching inline
// fix in operationalReportMapper.js), so given the identical rows/opening
// balances, they must produce the identical grand total — this test
// locks that cross-check in so the two calculations can't drift apart
// again silently.

const ROWS_WITH_WEIGHT_DRIFT = [
  { id: 'a1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-01', lot_no: 'L1', tracking_code: 'XX260630131', product_code: 'RPC039', qty: 32, weight: 317.79 },
  { id: 'a2', movement_type: 'DISPATCH', movement_date: '2026-07-30', lot_no: 'L1', tracking_code: 'XX260630131', product_code: 'RPC039', qty: 32, weight: 317.78 },

  { id: 'b1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-02', lot_no: 'L2', tracking_code: 'XX260630133', product_code: 'RPC039', qty: 3, weight: 30.39 },
  { id: 'b2', movement_type: 'DISPATCH', movement_date: '2026-07-22', lot_no: 'L2', tracking_code: 'XX260630133', product_code: 'RPC039', qty: 3, weight: 29.39 },

  { id: 'c1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-03', lot_no: 'L3', tracking_code: 'FR260704018', product_code: 'RPC049', qty: 23, weight: 260.00 },
  { id: 'c2', movement_type: 'DISPATCH', movement_date: '2026-07-18', lot_no: 'L3', tracking_code: 'FR260704018', product_code: 'RPC049', qty: 23, weight: 241.31 },

  { id: 'd1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-04', lot_no: 'L4', tracking_code: 'XX260630135', product_code: 'RPC049', qty: 4, weight: 38.10 },
  { id: 'd2', movement_type: 'DISPATCH', movement_date: '2026-07-15', lot_no: 'L4', tracking_code: 'XX260630135', product_code: 'RPC049', qty: 4, weight: 38.00 },

  // A genuinely still-open lot, so the comparison isn't trivially 0 for both.
  { id: 'e1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-06-05', lot_no: 'L5', tracking_code: 'FR260801001', product_code: 'RPC039', qty: 50, weight: 500 },
  { id: 'e2', movement_type: 'DISPATCH', movement_date: '2026-07-10', lot_no: 'L5', tracking_code: 'FR260801001', product_code: 'RPC039', qty: 20, weight: 200 },
];

describe('PDF report and Excel export agree on the grand total', () => {
  it('matches exactly, including across several fully-withdrawn lots with weight drift', () => {
    const openingBalances = new Map();

    const pdf = mapMovementLedgerToInventoryReportData({ rows: ROWS_WITH_WEIGHT_DRIFT, sortMode: 'productLot', openingBalances });
    const excelRows = buildMovementLedgerExcelRows(ROWS_WITH_WEIGHT_DRIFT, openingBalances, 'productLot', null);
    const totalRow = excelRows[excelRows.length - 1];

    expect(pdf.totalBalanceVolume).toBe(totalRow['คงเหลือ(กล่อง)']);
    expect(pdf.totalBalanceWeight).toBe(totalRow['คงเหลือ(น้ำหนัก)']);
    // Only the still-open lot (50 received - 20 delivered = 30 boxes / 300kg)
    // should remain — every depleted lot's drift residual is fully zeroed.
    expect(pdf.totalBalanceVolume).toBe(30);
    expect(pdf.totalBalanceWeight).toBe(300);
  });
});
