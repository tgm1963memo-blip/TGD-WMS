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
