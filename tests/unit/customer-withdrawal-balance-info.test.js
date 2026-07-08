import { describe, expect, it } from 'vitest';
import {
  getWithdrawalBalanceInfo,
  WITHDRAWAL_IDENTIFIER_TYPES,
} from '../../src/utils/customerWithdrawalLineDefaults.js';

// Mirrors the real incident this test guards against: withdrawal CWR-20260704-0012
// had two lines both drawing from tracking code FR260704002, a deposit line with
// only 100 boxes actual — but each line individually requested 200, so a
// single-line-only balance check would have caught it too. The cross-line check
// added here also catches the harder case where each line stays under the total
// on its own but the sum across lines in the same draft doesn't.
const depositLine = {
  id: 'dl-1',
  lot_no: '175',
  tracking_code: 'FR260704002',
  customer_product_code: '10385-7',
  actual_boxes: 100,
  actual_weight: 500,
};

function trackingLine({ key, requestedBoxes, requestedWeight }) {
  return {
    key,
    customer_product_code: '10385-7',
    identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE,
    identifier_value: 'FR260704002',
    requested_boxes: requestedBoxes,
    requested_weight: requestedWeight,
  };
}

describe('getWithdrawalBalanceInfo', () => {
  it('does not flag a single line within its deposit balance', () => {
    const line = trackingLine({ key: 1, requestedBoxes: '60', requestedWeight: '300' });
    const info = getWithdrawalBalanceInfo(line, [depositLine], [line]);
    expect(info.exceedsBoxBalance).toBe(false);
    expect(info.exceedsWtBalance).toBe(false);
  });

  it('flags a single line that alone exceeds the deposit balance', () => {
    const line = trackingLine({ key: 1, requestedBoxes: '200', requestedWeight: '1000' });
    const info = getWithdrawalBalanceInfo(line, [depositLine], [line]);
    expect(info.exceedsBoxBalance).toBe(true);
    expect(info.exceedsWtBalance).toBe(true);
  });

  it('flags two sibling lines that are each individually within balance but jointly exceed it', () => {
    const lineA = trackingLine({ key: 1, requestedBoxes: '60', requestedWeight: '300' });
    const lineB = trackingLine({ key: 2, requestedBoxes: '60', requestedWeight: '300' });
    const siblings = [lineA, lineB];

    const infoA = getWithdrawalBalanceInfo(lineA, [depositLine], siblings);
    const infoB = getWithdrawalBalanceInfo(lineB, [depositLine], siblings);

    // 60 + 60 = 120 > 100 available — at least one of the two must be flagged
    // so the draft as a whole can't be submitted.
    expect(infoA.exceedsBoxBalance || infoB.exceedsBoxBalance).toBe(true);
    expect(infoA.exceedsWtBalance || infoB.exceedsWtBalance).toBe(true);
  });

  it('reproduces the real incident: two lines each requesting the full deposit amount', () => {
    const lineA = trackingLine({ key: 1, requestedBoxes: '200', requestedWeight: '1000' });
    const lineB = trackingLine({ key: 2, requestedBoxes: '200', requestedWeight: '1000' });
    const siblings = [lineA, lineB];

    const infoA = getWithdrawalBalanceInfo(lineA, [depositLine], siblings);
    const infoB = getWithdrawalBalanceInfo(lineB, [depositLine], siblings);

    expect(infoA.exceedsBoxBalance).toBe(true);
    expect(infoB.exceedsBoxBalance).toBe(true);
  });

  it('allows two sibling lines that together exactly consume the balance', () => {
    const lineA = trackingLine({ key: 1, requestedBoxes: '50', requestedWeight: '250' });
    const lineB = trackingLine({ key: 2, requestedBoxes: '50', requestedWeight: '250' });
    const siblings = [lineA, lineB];

    const infoA = getWithdrawalBalanceInfo(lineA, [depositLine], siblings);
    const infoB = getWithdrawalBalanceInfo(lineB, [depositLine], siblings);

    expect(infoA.exceedsBoxBalance).toBe(false);
    expect(infoB.exceedsBoxBalance).toBe(false);
  });

  it('does not let an unrelated line (different tracking code) affect the balance check', () => {
    const otherDepositLine = { ...depositLine, id: 'dl-2', tracking_code: 'FR999999' };
    const line = trackingLine({ key: 1, requestedBoxes: '90', requestedWeight: '450' });
    const unrelated = trackingLine({ key: 2, requestedBoxes: '90', requestedWeight: '450' });
    unrelated.identifier_value = 'FR999999';

    const info = getWithdrawalBalanceInfo(line, [depositLine, otherDepositLine], [line, unrelated]);
    expect(info.exceedsBoxBalance).toBe(false);
  });
});
