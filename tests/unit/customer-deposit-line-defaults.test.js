import { describe, expect, it } from 'vitest';
import {
  createInitialDepositLines,
  DEPOSIT_LINE_DEFAULT_COUNT,
  getFilledDepositLines,
} from '../../src/utils/customerDepositLineDefaults.js';

describe('customerDepositLineDefaults', () => {
  it('creates ten empty deposit lines by default', () => {
    const lines = createInitialDepositLines();
    expect(lines).toHaveLength(DEPOSIT_LINE_DEFAULT_COUNT);
    expect(lines.every((line) => !line.catalog_product_id)).toBe(true);
  });

  it('returns only filled catalog lines for submission', () => {
    const lines = createInitialDepositLines();
    lines[0] = {
      ...lines[0],
      catalog_product_id: 'prod-1',
      customer_product_code: 'CUS-01',
      weight_per_box: '10',
      expected_boxes: '5',
      expected_weight: '50',
    };

    expect(getFilledDepositLines(lines)).toHaveLength(1);
  });
});
