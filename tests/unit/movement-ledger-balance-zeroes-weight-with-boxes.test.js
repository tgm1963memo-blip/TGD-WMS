import { describe, expect, it } from 'vitest';
import { addMovement, aggregateFinalBalances } from '../../src/utils/movementLedgerExcelUtils.js';

// Regression coverage for a real reported bug: a lot with 32 boxes
// deposited and all 32 withdrawn (box balance exactly 0) still showed a
// nonzero "คงเหลือ(น้ำหนัก)" — 0.01, 1.00, even 18.69 kg on different real
// rows — because the deposit's recorded weight and the withdrawal's
// recorded weight came from independent scale readings that didn't net
// to exactly zero. addMovement floored qty and weight independently, so
// a box-depleted lot kept whatever weight arithmetic happened to leave
// behind instead of being treated as fully gone. Fixed to mirror
// tgd_get_customer_stock_balance's own rule: once box balance hits (or
// drops below) zero, weight is zeroed too, not reported as a phantom
// residual with zero boxes to hold it.

const DEPOSIT = { movement_type_raw: 'RECEIVE_CONFIRM', qty: 32, weight: 317.79 };
const FULL_WITHDRAWAL_WITH_WEIGHT_DRIFT = { movement_type_raw: 'DISPATCH', qty: 32, weight: 317.78 };
const PARTIAL_WITHDRAWAL = { movement_type_raw: 'DISPATCH', qty: 20, weight: 200 };

describe('addMovement zeroes weight once box balance is fully depleted', () => {
  it('zeroes both qty and weight when a withdrawal exactly empties the boxes, even with leftover weight drift', () => {
    let balance = addMovement({ qty: 0, weight: 0 }, DEPOSIT);
    balance = addMovement(balance, FULL_WITHDRAWAL_WITH_WEIGHT_DRIFT);
    expect(balance).toEqual({ qty: 0, weight: 0 });
  });

  it('still tracks a genuine partial balance normally (boxes remain, weight is real)', () => {
    let balance = addMovement({ qty: 0, weight: 0 }, DEPOSIT);
    balance = addMovement(balance, PARTIAL_WITHDRAWAL);
    expect(balance.qty).toBe(12);
    expect(balance.weight).toBeCloseTo(117.79, 5);
  });

  it('floors a negative box balance (over-withdrawn data entry error) to zero, weight included', () => {
    const overWithdrawal = { movement_type_raw: 'DISPATCH', qty: 40, weight: 400 };
    let balance = addMovement({ qty: 0, weight: 0 }, DEPOSIT);
    balance = addMovement(balance, overWithdrawal);
    expect(balance).toEqual({ qty: 0, weight: 0 });
  });
});

describe('aggregateFinalBalances (used to seed both the Excel export and the on-screen ledger)', () => {
  it('reports a fully-depleted lot with a weight-drift residual as {qty:0, weight:0}, not a phantom kg balance', () => {
    const rows = [
      { customer_id: 'c1', lot_no: 'L1', ...DEPOSIT },
      { customer_id: 'c1', lot_no: 'L1', ...FULL_WITHDRAWAL_WITH_WEIGHT_DRIFT },
    ];
    const balances = aggregateFinalBalances(rows);
    const key = [...balances.keys()][0];
    expect(balances.get(key)).toEqual({ qty: 0, weight: 0 });
  });
});
