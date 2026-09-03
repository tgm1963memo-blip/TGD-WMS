import { describe, expect, it } from 'vitest';
import { buildInvoiceLotLedger } from '../../src/utils/invoiceLotLedgerUtils.js';

describe('buildInvoiceLotLedger', () => {
  it('walks balance forward -> received -> delivery -> balance per lot, chronologically', () => {
    const lines = [
      {
        lot_no: 'A2-01267889', product_code: 'R-021-1', product_name: 'เศษสามชั้น',
        movement_type: 'STORAGE_OPENING_BALANCE', movement_date: '2026-01-19',
        qty: 137, chargeable_weight: 2055, uom: 'KG',
      },
      {
        lot_no: 'A2-01267889', product_code: 'R-021-1', product_name: 'เศษสามชั้น',
        movement_type: 'DISPATCH', movement_date: '2026-04-27',
        qty: 24, chargeable_weight: 360, uom: 'KG',
        rate: 0, amount: 0, source_document_no: '2604270001',
      },
      {
        lot_no: 'A2-01267889', product_code: 'R-021-1', product_name: 'เศษสามชั้น',
        movement_type: 'DISPATCH', movement_date: '2026-04-28',
        qty: 24, chargeable_weight: 360, uom: 'KG',
        rate: 0, amount: 0, source_document_no: '2604280003',
      },
      {
        lot_no: 'A2-01267889', product_code: 'R-021-1', product_name: 'เศษสามชั้น',
        movement_type: 'STORAGE', rate: 0.42, amount: 1726.20,
      },
    ];

    const { lots, grandTotal } = buildInvoiceLotLedger(lines);

    expect(lots).toHaveLength(1);
    const lot = lots[0];
    expect(lot.rows).toHaveLength(3);

    expect(lot.rows[0]).toMatchObject({
      balanceForwardVolume: 137, balanceForwardWeight: 2055,
      balanceVolume: 137, balanceWeight: 2055,
    });
    expect(lot.rows[1]).toMatchObject({
      balanceForwardVolume: 137, deliveryVolume: 24, deliveryWeight: 360,
      balanceVolume: 113, balanceWeight: 1695,
    });
    expect(lot.rows[2]).toMatchObject({
      balanceForwardVolume: 113, deliveryVolume: 24, deliveryWeight: 360,
      balanceVolume: 89, balanceWeight: 1335,
    });

    // Storage charge (computed once per lot for the whole period) folds
    // onto the last event row rather than being split into fabricated
    // sub-period rows we have no real numbers for.
    expect(lot.rows[2].coldStorageCharge).toBe(1726.20);
    expect(lot.rows[2].chargeUnit).toBe(0.42);

    expect(lot.subtotal).toMatchObject({
      balanceForwardVolume: 137, balanceForwardWeight: 2055,
      deliveryVolume: 48, deliveryWeight: 720,
      balanceVolume: 89, balanceWeight: 1335,
      coldStorageCharge: 1726.20,
    });

    expect(grandTotal.balanceVolume).toBe(89);
    expect(grandTotal.coldStorageCharge).toBe(1726.20);
  });

  it('treats a lot with no opening balance as starting from zero', () => {
    const lines = [
      {
        lot_no: 'NEW-001', product_code: 'PA-003', product_name: 'สินค้าใหม่',
        movement_type: 'RECEIVE_CONFIRM', movement_date: '2026-04-05',
        qty: 50, chargeable_weight: 500, uom: 'KG',
        rate: 1.15, amount: 575, source_document_no: 'CDR-0001',
      },
    ];

    const { lots } = buildInvoiceLotLedger(lines);
    expect(lots[0].rows[0]).toMatchObject({
      balanceForwardVolume: 0, balanceForwardWeight: 0,
      receivedVolume: 50, receivedWeight: 500,
      balanceVolume: 50, balanceWeight: 500,
      handlingFee: 575,
    });
  });

  // Real reported gap: a draft created through the period-based STORAGE
  // flow (createBillingInvoiceDraftForPeriod, e.g. every OVO/TGM manual
  // draft this session worked with) has ONLY movement_type: 'STORAGE'
  // lines for a lot -- no separate RECEIVE_CONFIRM/DISPATCH movement lines
  // at all. Those lines carry no movement_date (only billing_period_start/
  // end, the cycle's own dates), so RECEIVED DATE/DELIVERY DATE printed
  // blank on the invoice for every such lot, even though the underlying
  // cycles do carry real dates.
  it('derives RECEIVED/DELIVERY dates from STORAGE cycle dates when a lot has no movement-type lines at all', () => {
    const lines = [
      {
        lot_no: 'A2-99999999', product_code: 'P-100', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', rate: 0.23, amount: 354.20, chargeable_weight: 1540,
        line_note: 'ค่าฝาก 1 งวด (งวดละ 15 วัน: 2026-08-03 ถึง 2026-08-17, น้ำหนักที่คิดค่าฝาก 1540 กก.)',
        billing_period_start: '2026-08-03', billing_period_end: '2026-08-17',
      },
      {
        lot_no: 'A2-99999999', product_code: 'P-100', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', rate: 0.23, amount: 354.20, chargeable_weight: 1540,
        line_note: 'ค่าฝาก 1 งวด (งวดละ 15 วัน: 2026-08-18 ถึง 2026-09-01, น้ำหนักที่คิดค่าฝาก 1540 กก.)',
        billing_period_start: '2026-08-18', billing_period_end: '2026-09-01',
      },
    ];

    const { lots } = buildInvoiceLotLedger(lines);
    expect(lots).toHaveLength(1);
    expect(lots[0].rows).toHaveLength(1);
    // Earliest cycle's start (the true receipt date when the first-ever
    // cycle is included) and latest cycle's end.
    expect(lots[0].rows[0].receivedDate).toBe('2026-08-03');
    expect(lots[0].rows[0].deliveryDate).toBe('2026-09-01');
    expect(lots[0].rows[0].coldStorageCharge).toBe(708.40);
    // Real reported gap: BALANCE FORWARD/BALANCE printed a flat 0.00 for a
    // storage-only lot even though it genuinely holds real weight this
    // period -- both cycles here hold the same 1540kg, so forward == balance.
    expect(lots[0].rows[0].balanceForwardWeight).toBe(1540);
    expect(lots[0].rows[0].balanceWeight).toBe(1540);
    // Cycle-detail text (period days, exact date range, weight) already
    // shown on the draft-view table should also reach the printed invoice —
    // only the LAST cycle's own note (the one anchoring this row's ending
    // balance), not every cycle folded into this row.
    expect(lots[0].rows[0].remark).toContain('2026-08-18 ถึง 2026-09-01');
    expect(lots[0].rows[0].remark).not.toContain('2026-08-03 ถึง 2026-08-17');
  });

  // Real reported gap: a lot billed over several STORAGE cycles within one
  // draft period can hold a DIFFERENT weight per cycle (a withdrawal or
  // extra deposit happened between cycle boundaries) -- picking one cycle's
  // weight arbitrarily for BALANCE FORWARD/BALANCE showed numbers that
  // didn't reconcile against each other or against the cycle-detail notes.
  it('reconciles BALANCE FORWARD -> RECEIVED/DELIVERY -> BALANCE across multiple STORAGE cycles with different weights', () => {
    const lines = [
      {
        lot_no: 'LOT-1', product_code: 'QP', product_name: 'QP กลาง ใส่กล่อง',
        movement_type: 'STORAGE', rate: 0.58, amount: 580, chargeable_weight: 1000,
        line_note: 'cycle 1 (1000kg)', billing_period_start: '2026-08-11', billing_period_end: '2026-08-25',
      },
      {
        lot_no: 'LOT-1', product_code: 'QP', product_name: 'QP กลาง ใส่กล่อง',
        movement_type: 'STORAGE', rate: 0.58, amount: 1160, chargeable_weight: 2000,
        line_note: 'cycle 2 (2000kg, +1000 received)', billing_period_start: '2026-08-13', billing_period_end: '2026-08-27',
      },
      {
        lot_no: 'LOT-1', product_code: 'QP', product_name: 'QP กลาง ใส่กล่อง',
        movement_type: 'STORAGE', rate: 0.58, amount: 1148.40, chargeable_weight: 1980,
        line_note: 'cycle 3 (1980kg, -20 delivered)', billing_period_start: '2026-08-15', billing_period_end: '2026-08-29',
      },
    ];

    const { lots } = buildInvoiceLotLedger(lines);
    expect(lots).toHaveLength(1);
    expect(lots[0].rows).toHaveLength(1);
    const row = lots[0].rows[0];
    // Forward = first cycle's weight (period-start), balance = last cycle's
    // weight (period-end, matching the selected end date).
    expect(row.balanceForwardWeight).toBe(1000);
    expect(row.balanceWeight).toBe(1980);
    // 1000 -> 2000 is a +1000 received; 2000 -> 1980 is a -20 delivered.
    expect(row.receivedWeight).toBe(1000);
    expect(row.deliveryWeight).toBe(20);
    // Must reconcile exactly: forward + received - delivery = balance.
    expect(row.balanceForwardWeight + row.receivedWeight - row.deliveryWeight).toBe(row.balanceWeight);
    // Shows how many cycles were bundled into this one row's charge.
    expect(row.cycleCount).toBe(3);
    // Only the last (chronologically) cycle's own note shows -- a lot
    // catching up several cycles in one draft must not dump every cycle's
    // sentence onto one row; the reconciled numbers above already
    // summarize the whole span.
    expect(row.remark).toBe('cycle 3 (1980kg, -20 delivered)');
  });

  // Real reported gap: two DIFFERENT deposit lines (different receipt
  // dates, different tracking codes) shared the same free-text lot_no --
  // this customer types a date/description as their lot_no, not a unique
  // identifier -- so grouping by lot_no::product_code alone merged their
  // two independently-consistent cycle histories into one row whose
  // combined weights/dates looked like overlapping/duplicate billing.
  it('keeps two deposit lines separate when they share the same free-text lot_no but have different deposit_line_id', () => {
    const lines = [
      {
        lot_no: '10/08/2026 ต้น ใส่กล่อง', product_code: 'P-420', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', deposit_line_id: 'dep-A', amount: 92, chargeable_weight: 400,
        billing_period_start: '2026-08-01', billing_period_end: '2026-08-15',
      },
      {
        lot_no: '10/08/2026 ต้น ใส่กล่อง', product_code: 'P-420', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', deposit_line_id: 'dep-A', amount: 89.7, chargeable_weight: 390,
        billing_period_start: '2026-08-16', billing_period_end: '2026-08-30',
      },
      {
        lot_no: '10/08/2026 ต้น ใส่กล่อง', product_code: 'P-420', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', deposit_line_id: 'dep-B', amount: 230, chargeable_weight: 1000,
        billing_period_start: '2026-08-04', billing_period_end: '2026-08-18',
      },
      {
        lot_no: '10/08/2026 ต้น ใส่กล่อง', product_code: 'P-420', product_name: 'สินค้าฝาก',
        movement_type: 'STORAGE', deposit_line_id: 'dep-B', amount: 227.7, chargeable_weight: 990,
        billing_period_start: '2026-08-19', billing_period_end: '2026-09-02',
      },
    ];

    const { lots } = buildInvoiceLotLedger(lines);
    expect(lots).toHaveLength(2);

    const depA = lots.find((l) => l.rows[0].balanceForwardWeight === 400);
    expect(depA.rows[0].cycleCount).toBe(2);
    expect(depA.rows[0].balanceWeight).toBe(390);

    const depB = lots.find((l) => l.rows[0].balanceForwardWeight === 1000);
    expect(depB.rows[0].cycleCount).toBe(2);
    expect(depB.rows[0].balanceWeight).toBe(990);
  });

  it('groups multiple lots independently and sums a grand total across them', () => {
    const lines = [
      { lot_no: 'L1', product_code: 'P1', movement_type: 'STORAGE_OPENING_BALANCE', qty: 10, chargeable_weight: 100 },
      { lot_no: 'L2', product_code: 'P2', movement_type: 'STORAGE_OPENING_BALANCE', qty: 20, chargeable_weight: 200 },
    ];
    const { lots, grandTotal } = buildInvoiceLotLedger(lines);
    expect(lots).toHaveLength(2);
    expect(grandTotal.balanceForwardVolume).toBe(30);
    expect(grandTotal.balanceForwardWeight).toBe(300);
  });
});
