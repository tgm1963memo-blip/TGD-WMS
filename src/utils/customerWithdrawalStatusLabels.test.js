import { describe, it, expect, vi } from 'vitest';
import { getWithdrawalStatusLabel, getLinePickingStatus } from './customerWithdrawalStatusLabels.js';

describe('customerWithdrawalStatusLabels', () => {
  describe('getWithdrawalStatusLabel', () => {
    it('returns translated label if key exists', () => {
      const t = vi.fn().mockImplementation((key) => `translated_${key}`);
      expect(getWithdrawalStatusLabel('COMPLETED', t)).toBe('translated_customer_withdrawal_status_completed');
    });

    it('returns raw status if key does not exist', () => {
      const t = vi.fn();
      expect(getWithdrawalStatusLabel('UNKNOWN_STATUS', t)).toBe('UNKNOWN_STATUS');
    });
  });

  describe('getLinePickingStatus', () => {
    it('returns PICKED if line has picked_at', () => {
      expect(getLinePickingStatus({ picked_at: '2023-01-01' }, 'WAREHOUSE_PICKING')).toBe('PICKED');
    });

    it('returns PENDING if line has no picked_at and document is not COMPLETED or DISPATCHED', () => {
      expect(getLinePickingStatus({ picked_at: null }, 'WAREHOUSE_PICKING')).toBe('PENDING');
      expect(getLinePickingStatus({}, 'ADMIN_ACCEPTED')).toBe('PENDING');
    });

    it('returns PICKED if document is COMPLETED even if line has no picked_at', () => {
      expect(getLinePickingStatus({ picked_at: null }, 'COMPLETED')).toBe('PICKED');
    });

    it('returns PICKED if document is DISPATCHED even if line has no picked_at', () => {
      expect(getLinePickingStatus({}, 'DISPATCHED')).toBe('PICKED');
    });
  });
});
