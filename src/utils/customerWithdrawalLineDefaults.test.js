import { describe, it, expect } from 'vitest';
import { getWithdrawalBalanceInfo } from './customerWithdrawalLineDefaults.js';

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
