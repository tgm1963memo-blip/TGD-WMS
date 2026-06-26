import { describe, it, expect } from 'vitest';
import { classifyExpiryStatus, classifyAgingBucket, summarizeAgingRows } from '../../src/services/storageAgingReportService.js';

describe('storageAgingReportService', () => {
  describe('classifyExpiryStatus', () => {
    it('returns NO_EXPIRY_DATE for null expiry', () => {
      expect(classifyExpiryStatus(null, new Date('2026-06-26'))).toBe('NO_EXPIRY_DATE');
    });

    it('returns NO_EXPIRY_DATE for undefined expiry', () => {
      expect(classifyExpiryStatus(undefined, new Date('2026-06-26'))).toBe('NO_EXPIRY_DATE');
    });

    it('returns NO_EXPIRY_DATE for empty string expiry', () => {
      expect(classifyExpiryStatus('', new Date('2026-06-26'))).toBe('NO_EXPIRY_DATE');
    });

    it('returns EXPIRED for a date in the past', () => {
      expect(classifyExpiryStatus('2026-06-25', new Date('2026-06-26'))).toBe('EXPIRED');
    });

    it('returns EXPIRED for a date far in the past', () => {
      expect(classifyExpiryStatus('2025-01-01', new Date('2026-06-26'))).toBe('EXPIRED');
    });

    it('returns NEAR_EXPIRY for a date within 30 days', () => {
      expect(classifyExpiryStatus('2026-07-15', new Date('2026-06-26'))).toBe('NEAR_EXPIRY');
    });

    it('returns NEAR_EXPIRY for a date exactly 30 days away', () => {
      expect(classifyExpiryStatus('2026-07-26', new Date('2026-06-26'))).toBe('NEAR_EXPIRY');
    });

    it('returns GOOD for a date further than 30 days', () => {
      expect(classifyExpiryStatus('2026-08-15', new Date('2026-06-26'))).toBe('GOOD');
    });

    it('returns GOOD for a date far in the future', () => {
      expect(classifyExpiryStatus('2027-12-31', new Date('2026-06-26'))).toBe('GOOD');
    });
  });

  describe('classifyAgingBucket', () => {
    it('classifies 0 days as 0_30', () => {
      expect(classifyAgingBucket(0)).toBe('0_30');
    });
    it('classifies 30 days as 0_30', () => {
      expect(classifyAgingBucket(30)).toBe('0_30');
    });
    it('classifies 31 days as 31_60', () => {
      expect(classifyAgingBucket(31)).toBe('31_60');
    });
    it('classifies 91 days as OVER_90', () => {
      expect(classifyAgingBucket(91)).toBe('OVER_90');
    });
  });

  describe('summarizeAgingRows', () => {
    const mockRows = [
      {
        customer_id: 'c1', lot_id: 'l1', pallet_id: 'p1',
        qty_on_hand: 10, chargeable_days: 5, aging_days: 15,
        aging_bucket: '0_30', expiry_status: 'EXPIRED',
        remaining_shelf_life_days: -5,
      },
      {
        customer_id: 'c1', lot_id: 'l2', pallet_id: 'p2',
        qty_on_hand: 20, chargeable_days: 10, aging_days: 45,
        aging_bucket: '31_60', expiry_status: 'NEAR_EXPIRY',
        remaining_shelf_life_days: 10,
      },
      {
        customer_id: 'c2', lot_id: 'l3', pallet_id: 'p3',
        qty_on_hand: 30, chargeable_days: 20, aging_days: 100,
        aging_bucket: 'OVER_90', expiry_status: 'GOOD',
        remaining_shelf_life_days: 180,
      },
      {
        customer_id: 'c2', lot_id: 'l4', pallet_id: 'p4',
        qty_on_hand: 5, chargeable_days: 3, aging_days: 10,
        aging_bucket: '0_30', expiry_status: 'NO_EXPIRY_DATE',
        remaining_shelf_life_days: null,
      },
    ];

    it('counts expired lots correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      expect(summary.expired_lots).toBe(1);
    });

    it('counts near expiry lots correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      expect(summary.near_expiry_lots).toBe(1);
    });

    it('counts no expiry lots correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      expect(summary.no_expiry_lots).toBe(1);
    });

    it('calculates average storage age correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      // (15 + 45 + 100 + 10) / 4 = 42.5 => rounded to 43
      expect(summary.average_storage_age).toBe(43);
    });

    it('calculates average shelf life from lots WITH expiry only', () => {
      const summary = summarizeAgingRows(mockRows);
      // lots_with_expiry = 3 (l1, l2, l3) — l4 has null
      // total_remaining = -5 + 10 + 180 = 185
      // 185 / 3 = 61.67 => rounded to 62
      expect(summary.average_shelf_life).toBe(62);
    });

    it('counts total stock qty correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      expect(summary.total_stock_qty).toBe(65);
    });

    it('counts unique customers correctly', () => {
      const summary = summarizeAgingRows(mockRows);
      expect(summary.total_customers).toBe(2);
    });

    it('returns zero averages for empty rows', () => {
      const summary = summarizeAgingRows([]);
      expect(summary.average_storage_age).toBe(0);
      expect(summary.average_shelf_life).toBe(0);
      expect(summary.expired_lots).toBe(0);
      expect(summary.near_expiry_lots).toBe(0);
      expect(summary.no_expiry_lots).toBe(0);
    });

    it('sum of status counts equals total rows', () => {
      const summary = summarizeAgingRows(mockRows);
      const statusSum = summary.expired_lots + summary.near_expiry_lots + summary.no_expiry_lots;
      // GOOD lots are not counted in the 3 categories above, so add implied good count
      const goodLots = mockRows.filter(r => r.expiry_status === 'GOOD').length;
      expect(statusSum + goodLots).toBe(mockRows.length);
    });
  });
});
