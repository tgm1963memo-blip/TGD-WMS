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
    // The core identity this bug broke: opening + received - delivered = closing.
    expect(pdf.totalBalanceForwardWeight + pdf.totalReceivedWeight - pdf.totalDeliveryWeight).toBe(pdf.totalBalanceWeight);

    const excelRows = buildMovementLedgerExcelRows(rows, openingBalances, 'productLot', authoritativeTotals);
    const totalRow = excelRows[excelRows.length - 1];
    expect(totalRow['รับเข้า(น้ำหนัก)']).toBe(500);
    expect(totalRow['จ่ายออก(น้ำหนัก)']).toBe(1200);
    expect(totalRow['คงเหลือ(น้ำหนัก)']).toBe(300);
  });
});

// Second real gap found while fixing the one above: after routing รับเข้า/
// จ่ายออก back to period-scoped sums, ยอดยกมา was STILL wrong on a real
// report -- undercounted by the exact weight of every lot that had an
// opening balance but ZERO movement rows within the period (received
// earlier, never touched again this month, just sitting in storage). Such
// a lot never gets a lotBalances entry (built only by walking this
// period's own mappedLines), so totalBalanceForwardVol/Wt's
// `Object.keys(lotBalances)`-scoped sum silently dropped its
// openingBalances contribution -- while คงเหลือ (via authoritativeTotals,
// which scans every lot's current balance regardless of activity) still
// included it, breaking ยอดยกมา+รับเข้า-จ่ายออก=คงเหลือ all over again from a
// different column.
describe('ยอดยกมา includes a lot with an opening balance but zero movement this period', () => {
  it('counts an untouched lot in ยอดยกมา, not just lots that also moved this period', () => {
    const openingBalances = new Map([
      // LOTA: carried in from before this period and moved (dispatched) during it.
      ['|P1|lot:LOTA', { qty: 10, weight: 100 }],
      // LOTB: carried in from before this period, sitting untouched all through it.
      ['|P1|lot:LOTB', { qty: 20, weight: 200 }],
    ]);
    const rows = [
      { id: 'a1', movement_type: 'DISPATCH', movement_date: '2026-08-05', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 10, weight: 100 },
    ];

    const pdf = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot', openingBalances });

    // Both lots' opening weight must be counted, not just LOTA's (the only
    // one with a row this period).
    expect(pdf.totalBalanceForwardWeight).toBe(300);
    // LOTA closes to 0, LOTB's balance is untouched -- closing total is LOTB alone.
    expect(pdf.totalBalanceWeight).toBe(200);
    expect(pdf.totalDeliveryWeight).toBe(100);
    expect(pdf.totalReceivedWeight).toBe(0);
    expect(pdf.totalBalanceForwardWeight + pdf.totalReceivedWeight - pdf.totalDeliveryWeight).toBe(pdf.totalBalanceWeight);
  });
});

// Third real gap, found immediately after fixing the two above: a printed
// page's own SUB TOTAL ยอดยกมา matched exactly when checked against just
// that page's rows in isolation (each page's own lots each appear once
// there) -- but summing every page's SUB TOTAL ยอดยกมา across an entire real
// report came to 435,800 กก. against a true grand total of 159,080 กก. A
// lot with several movements in the period (received once, dispatched down
// over several rows) repeats its running balanceForwardWeight on every row
// it touches -- correct for that row's own "what was on hand right before
// this event" display, but summing that column blindly counts the same
// underlying stock once per row, not once per lot.
describe('a lot with several rows only contributes its opening balance once to a page/document total', () => {
  it('flags exactly the first row of each lot as _isFirstOccurrenceOfLot', () => {
    const openingBalances = new Map([
      ['|P1|lot:LOTA', { qty: 20, weight: 200 }],
    ]);
    const rows = [
      // LOTA: carried in, then drawn down over three separate dispatch events.
      { id: 'a1', movement_type: 'DISPATCH', movement_date: '2026-08-05', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
      { id: 'a2', movement_type: 'DISPATCH', movement_date: '2026-08-10', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
      { id: 'a3', movement_type: 'DISPATCH', movement_date: '2026-08-15', lot_no: 'LOTA', tracking_code: 'FR260701001', product_code: 'P1', qty: 5, weight: 50 },
      // LOTB: a single, unrelated lot for comparison.
      { id: 'b1', movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-08-01', lot_no: 'LOTB', tracking_code: 'FR260801001', product_code: 'P1', qty: 10, weight: 100 },
    ];

    const pdf = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot', openingBalances });
    const flaggedLines = pdf.lines.filter((l) => l._isFirstOccurrenceOfLot);

    // Exactly one row per distinct lot is flagged (2 lots -> 2 flagged rows),
    // not one per row (4 rows total).
    expect(flaggedLines).toHaveLength(2);

    // Summing balanceForwardWeight over ONLY the flagged rows gives the true
    // opening total; summing it over every row would triple-count LOTA's
    // 200kg opening balance (it appears on 3 rows) and wildly overstate it.
    const sumOverFlaggedOnly = flaggedLines.reduce((s, l) => s + l.balanceForwardWeight, 0);
    const sumOverEveryRow = pdf.lines.reduce((s, l) => s + l.balanceForwardWeight, 0);
    expect(sumOverFlaggedOnly).toBe(200); // LOTA's true opening weight, counted once.
    expect(sumOverFlaggedOnly).toBe(pdf.totalBalanceForwardWeight);
    expect(sumOverEveryRow).toBeGreaterThan(sumOverFlaggedOnly); // the naive per-row sum overcounts.
  });
});
