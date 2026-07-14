import { describe, it, expect } from 'vitest';
import { getMatchedDepositLine, getWithdrawalBalanceInfo } from './customerWithdrawalLineDefaults.js';

describe('getWithdrawalBalanceInfo (regression: zero-remaining-balance falsy bug)', () => {
  const depositLine = {
    id: 'dl-1',
    customer_product_code: 'RPC048',
    product_name: 'ไหล่',
    lot_no: '069',
    tracking_code: 'XX2606300069',
    actual_boxes: 0,
    actual_weight: 0,
    expected_boxes: 200,
    expected_weight: 1000,
  };

  it('flags a request against a genuinely zero remaining balance instead of silently falling back to the original deposited total', () => {
    const line = {
      key: 1,
      customer_product_code: 'RPC048',
      product_name: 'ไหล่',
      identifier_type: 'TRACKING_CODE',
      identifier_value: 'XX2606300069',
      requested_boxes: '145',
      requested_weight: '701.5',
    };

    const info = getWithdrawalBalanceInfo(line, [depositLine], [line]);
    expect(info.maxBoxBalance).toBe(0);
    expect(info.maxWtBalance).toBe(0);
    expect(info.exceedsBoxBalance).toBe(true);
    expect(info.exceedsWtBalance).toBe(true);
  });

  it('does not flag when there is no matched deposit line at all (unknown reference, not zero balance)', () => {
    const line = {
      key: 1,
      customer_product_code: 'UNKNOWN',
      product_name: 'unknown product',
      identifier_type: 'LOT',
      lot_no: '999',
      requested_boxes: '10',
      requested_weight: '50',
    };

    const info = getWithdrawalBalanceInfo(line, [depositLine], [line]);
    expect(info.exceedsBoxBalance).toBe(false);
    expect(info.exceedsWtBalance).toBe(false);
  });

  it('does not flag a request within a genuinely positive remaining balance', () => {
    const positiveLine = { ...depositLine, actual_boxes: 20, actual_weight: 100 };
    const line = {
      key: 1,
      customer_product_code: 'RPC048',
      product_name: 'ไหล่',
      identifier_type: 'TRACKING_CODE',
      identifier_value: 'XX2606300069',
      requested_boxes: '10',
      requested_weight: '50',
    };

    const info = getWithdrawalBalanceInfo(line, [positiveLine], [line]);
    expect(info.exceedsBoxBalance).toBe(false);
    expect(info.exceedsWtBalance).toBe(false);
  });
});

describe('getMatchedDepositLine / getWithdrawalBalanceInfo (regression: one LOT spanning two deposit lines)', () => {
  // Real incident: LOT "031 sup 49" for RPC049 has two receiving batches —
  // FR260704016 (24 boxes/120kg, untouched) and XX260702001 (34 boxes/333kg
  // deposited, 24/120 already withdrawn elsewhere, 10/213 remaining).
  const batchA = {
    id: 'batch-A-untouched',
    customer_product_code: 'RPC049',
    product_name: 'เศษชายสามชั้น',
    lot_no: '031 sup 49',
    tracking_code: 'FR260704016',
    actual_boxes: 24,
    actual_weight: 120,
    expected_boxes: 24,
    expected_weight: 120,
  };
  const batchB = {
    id: 'batch-B-remaining',
    customer_product_code: 'RPC049',
    product_name: 'เศษชายสามชั้น',
    lot_no: '031 sup 49',
    tracking_code: 'XX260702001',
    actual_boxes: 10,
    actual_weight: 213,
    expected_boxes: 34,
    expected_weight: 333,
  };
  const depositLines = [batchA, batchB];

  function lotLine(key, boxes, weight) {
    return {
      key,
      customer_product_code: 'RPC049',
      product_name: 'เศษชายสามชั้น',
      identifier_type: 'LOT',
      lot_no: '031 sup 49',
      requested_boxes: String(boxes),
      requested_weight: String(weight),
    };
  }

  it('resolves two rows referencing the same LOT to their own distinct batch instead of both collapsing onto the same one', () => {
    const rowFullBatch = lotLine(1, 24, 120);
    const rowRemainingBatch = lotLine(2, 10, 97.94);

    expect(getMatchedDepositLine(rowFullBatch, depositLines).id).toBe('batch-A-untouched');
    expect(getMatchedDepositLine(rowRemainingBatch, depositLines).id).toBe('batch-B-remaining');
  });

  it('does not flag either row as exceeding when each individually fits its own batch', () => {
    const rowFullBatch = lotLine(1, 24, 120);
    const rowRemainingBatch = lotLine(2, 10, 97.94);
    const siblings = [rowFullBatch, rowRemainingBatch];

    const infoA = getWithdrawalBalanceInfo(rowFullBatch, depositLines, siblings);
    expect(infoA.exceedsBoxBalance).toBe(false);
    expect(infoA.exceedsWtBalance).toBe(false);

    const infoB = getWithdrawalBalanceInfo(rowRemainingBatch, depositLines, siblings);
    expect(infoB.exceedsBoxBalance).toBe(false);
    expect(infoB.exceedsWtBalance).toBe(false);
  });

  it('still flags a request that truly exceeds every candidate batch', () => {
    const rowTooMuch = lotLine(1, 145, 701.5);
    const info = getWithdrawalBalanceInfo(rowTooMuch, depositLines, [rowTooMuch]);
    expect(info.exceedsBoxBalance).toBe(true);
  });
});
