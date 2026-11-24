import { describe, expect, it } from 'vitest';
import { computeUnlocatedStock } from '../../src/services/unlocatedStockService.js';

// "ยังไม่ระบุ Location" card on the dashboard: boxes still in stock that
// were never put on a pallet location, as a share of all boxes in stock.

const customersById = new Map([['c1', { id: 'c1', customer_name: 'ไทย-เยอรมัน' }]]);

function line(id, { inStock, raw = inStock, receivedAt = '2026-11-24', tracking = id } = {}) {
  return {
    id,
    deposit_request_id: `dr-${id}`,
    tracking_code: tracking,
    product_name: 'สินค้า',
    actual_boxes: inStock,
    actual_weight: inStock * 10,
    raw_actual_boxes: raw,
    raw_actual_weight: raw * 10,
    request: { id: `dr-${id}`, customer_id: 'c1', reviewed_at: receivedAt },
  };
}

describe('computeUnlocatedStock', () => {
  it('counts fully and partly unlocated lines against all boxes in stock', () => {
    const result = computeUnlocatedStock({
      lines: [line('A', { inStock: 15 }), line('B', { inStock: 120 }), line('C', { inStock: 65 })],
      allocations: [
        { line_id: 'B', boxes: 80, weight: 800 },
        { line_id: 'C', boxes: 65, weight: 650 },
      ],
      customersById,
    });

    expect(result.lots).toBe(2); // C is fully placed
    expect(result.boxes).toBe(15 + 40);
    expect(result.totalBoxes).toBe(200);
    expect(result.pct).toBe(27.5);
    expect(result.items.map((i) => [i.trackingCode, i.unlocatedBoxes, i.linePct])).toEqual([
      ['A', 15, 100],
      ['B', 40, 33],
    ]);
    expect(result.items[0].customerName).toBe('ไทย-เยอรมัน');
  });

  it('caps the unlocated part at what is still in stock after withdrawals', () => {
    // 100 received, 60 placed, 70 withdrawn: 30 left, and all of it may be on
    // the pallet, but at most 30 can be unlocated.
    const result = computeUnlocatedStock({
      lines: [line('D', { inStock: 30, raw: 100 })],
      allocations: [{ line_id: 'D', boxes: 60, weight: 600 }],
      customersById,
    });
    expect(result.items[0].unlocatedBoxes).toBe(30);
  });

  it('ignores lines with nothing left in stock and lists the oldest receipt first', () => {
    const result = computeUnlocatedStock({
      lines: [
        line('new', { inStock: 5, receivedAt: '2026-11-24' }),
        line('gone', { inStock: 0, raw: 50 }),
        line('old', { inStock: 5, receivedAt: '2026-11-20' }),
      ],
      allocations: [],
      customersById,
    });
    expect(result.items.map((i) => i.trackingCode)).toEqual(['old', 'new']);
    expect(result.totalBoxes).toBe(10);
    expect(result.pct).toBe(100);
  });

  it('returns zeros when there is no stock', () => {
    expect(computeUnlocatedStock({})).toMatchObject({ lots: 0, boxes: 0, totalBoxes: 0, pct: 0, items: [] });
  });
});
