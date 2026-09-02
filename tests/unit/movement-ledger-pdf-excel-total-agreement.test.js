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

// Real reported gap: getAuthoritativeBalanceTotals is built on the stock
// balance RPC's own base_lines CTE, whose final SELECT filters
// `WHERE balance > 0` (tgd_get_customer_stock_balance /
// tgd_get_all_customer_stock_balances) -- correct for its real purpose
// (current stock on hand), but it means a lot that reached zero balance by
// asOfDate is excluded from the RPC's result set ENTIRELY, taking its whole
// received/delivered contribution with it. A previous fix mistakenly routed
// รับเข้า/จ่ายออก through this same "current balance only" source (to make
// them agree with the balance-only คงเหลือ), which broke them instead: a
// lot carried in from before the report period and fully dispatched during
// it (any "CLOSED" withdrawal) vanished from both totals, even though its
// movements are still correctly present in the period's own rows. Confirmed
// against a real OVO August report: จ่ายออก undercounted by ~135,840 กก.,
// almost exactly equal to ยอดยกมา -- nearly every closed-out lot's delivery
// dropped out while still counted in the opening/closing balance.
describe('รับเข้า/จ่ายออก stay period-scoped even when authoritativeTotals omits a now-closed lot', () => {
  it('keeps a fully-dispatched-within-period lot in both totals, not just the still-open lot', () => {
    // Key format matches movementBalanceKey(row, 'lot'): `${customer_id ?? ''}|${product}|lot:${lot_no}`.
    const openingBalances = new Map([
      ['|P1|lot:LOTX', { qty: 100, weight: 1000 }],
    ]);
    const rows = [
      // Lot X: carried in from before this period (no receive row here),
      // fully dispatched during it -- closes to zero balance.
      { id: 'x1', movement_type: 'DISPATCH', movement_date: '2026-08-05', lot_no: 'LOTX', tracking_code: 'FR260701001', product_code: 'P1', qty: 100, weight: 1000 },
      // Lot Y: received and partially dispatched during this period, still open at period end.
      { id: 'y1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-08-10', lot_no: 'LOTY', tracking_code: 'FR260810001', product_code: 'P1', qty: 50, weight: 500 },
      { id: 'y2', movement_type: 'DISPATCH', movement_date: '2026-08-20', lot_no: 'LOTY', tracking_code: 'FR260810001', product_code: 'P1', qty: 20, weight: 200 },
    ];

    // Simulates what the real RPC actually returns: LOTX has 0 balance by
    // report end, so it's silently absent from every one of these figures.
    const authoritativeTotals = {
      totalBoxes: 30, totalWeight: 300,
      totalReceivedBoxes: 50, totalReceivedWeight: 500,
      totalDeliveredBoxes: 20, totalDeliveredWeight: 200,
    };

    const pdf = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot', openingBalances, authoritativeTotals });

    expect(pdf.totalReceivedWeight).toBe(500);
    expect(pdf.totalDeliveryWeight).toBe(1200);
    expect(pdf.totalBalanceWeight).toBe(300);

    const excelRows = buildMovementLedgerExcelRows(rows, openingBalances, 'productLot', authoritativeTotals);
    const totalRow = excelRows[excelRows.length - 1];
    expect(totalRow['รับเข้า(น้ำหนัก)']).toBe(500);
    expect(totalRow['จ่ายออก(น้ำหนัก)']).toBe(1200);
    expect(totalRow['คงเหลือ(น้ำหนัก)']).toBe(300);
  });
});

// ยอดยกมา's TOTAL is deliberately the plain sum of every printed row's own
// balanceForwardVolume/Weight -- NOT each distinct lot's true opening
// balance counted once. Confirmed wanted this way (reversing an earlier
// attempt at this session that counted each lot once): the printed report's
// per-page SUB TOTAL ยอดยกมา is itself a plain per-page row sum (so it's
// verifiable by adding up exactly what's printed on that one page), and the
// grand TOTAL must equal the sum of every page's own SUB TOTAL exactly.
// Both properties hold together only because pagination is a pure partition
// of the same rows with nothing dropped or duplicated -- so summing every
// row once here is mathematically identical to summing every page's own
// row-sum. The trade-off, confirmed accepted: a lot with more than one row
// in the period contributes its running balance once per row (not once
// total), so ยอดยกมา no longer represents true non-duplicated opening stock,
// and it will NOT generally satisfy ยอดยกมา+รับเข้า-จ่ายออก=คงเหลือ once any
// lot has repeat rows -- same reason a lot with ZERO rows in the period
// (sitting untouched, never printed at all) can no longer contribute to
// ยอดยกมา either, since it's not part of any page's row sum.
describe('ยอดยกมา TOTAL is the plain sum of every printed row, matching what page SUB TOTALs would sum to', () => {
  it('counts a lot with several rows once per row, not once per lot', () => {
    const openingBalances = new Map([
      ['|P1|lot:LOTA', { qty: 20, weight: 200 }],
    ]);
    const rows = [
      // LOTA: carried in, then drawn down over three separate dispatch events
      // -- each row repeats LOTA's own running balanceForwardWeight.
      { id: 'a1', movement_type: 'DISPATCH', movement_date: '2026-08-05', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
      { id: 'a2', movement_type: 'DISPATCH', movement_date: '2026-08-10', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
      { id: 'a3', movement_type: 'DISPATCH', movement_date: '2026-08-15', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
    ];

    const pdf = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot', openingBalances });

    // Row 1: balance forward 200 (LOTA's opening). Row 2: 150 (200-50).
    // Row 3: 100 (150-50). Summed once per row: 200+150+100 = 450 -- NOT
    // LOTA's true 200kg opening balance counted once.
    expect(pdf.lines.map((l) => l.balanceForwardWeight)).toEqual([200, 150, 100]);
    expect(pdf.totalBalanceForwardWeight).toBe(450);
    // Exactly the plain sum of every printed row -- what summing every
    // page's own SUB TOTAL would also produce, since pages only partition
    // these same rows.
    expect(pdf.totalBalanceForwardWeight).toBe(
      pdf.lines.reduce((sum, l) => sum + l.balanceForwardWeight, 0),
    );
  });

  it('excludes a lot with zero rows in the period entirely, even though it has an opening balance', () => {
    const openingBalances = new Map([
      ['|P1|lot:LOTA', { qty: 10, weight: 100 }],
      // LOTB: carried in from before this period, sitting untouched the
      // whole time -- never appears as a printed row, so it can't
      // contribute to any page's SUB TOTAL, and therefore not to TOTAL either.
      ['|P1|lot:LOTB', { qty: 20, weight: 200 }],
    ]);
    const rows = [
      { id: 'a1', movement_type: 'DISPATCH', movement_date: '2026-08-05', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 10, weight: 100 },
    ];

    const pdf = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot', openingBalances });

    expect(pdf.totalBalanceForwardWeight).toBe(100); // LOTA only -- LOTB's 200kg is not printed anywhere.
  });
});
