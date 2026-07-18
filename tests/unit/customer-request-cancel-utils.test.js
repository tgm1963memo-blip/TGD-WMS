import { describe, expect, it } from 'vitest';
import {
  getDepositCancelEligibility,
  getDepositRecallEligibility,
  getWithdrawalCancelEligibility,
  meetsCancelLeadTime,
} from '../../src/utils/customerRequestCancelUtils.js';

describe('customerRequestCancelUtils', () => {
  it('allows admin to cancel non-terminal deposit requests', () => {
    const result = getDepositCancelEligibility(
      { status: 'ADMIN_REVIEWING', expected_arrival_date: '2099-01-01' },
      'admin',
      { deposit_cancel_lead_days: 3, withdrawal_cancel_lead_days: 3 },
    );
    expect(result.canCancel).toBe(true);
  });

  it('blocks customer cancellation when lead time is not met', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);

    const result = getDepositCancelEligibility(
      { status: 'SUBMITTED_BY_CUSTOMER', expected_arrival_date: iso },
      'customer_user',
      { deposit_cancel_lead_days: 3, withdrawal_cancel_lead_days: 3 },
    );

    expect(result.canCancel).toBe(false);
    expect(result.reasonKey).toBe('customer_request_cancel_lead_time');
  });

  it('allows customer draft cancellation without lead time', () => {
    const result = getDepositCancelEligibility(
      { status: 'DRAFT', expected_arrival_date: null },
      'customer_user',
      { deposit_cancel_lead_days: 3, withdrawal_cancel_lead_days: 3 },
    );
    expect(result.canCancel).toBe(true);
  });

  it('evaluates withdrawal lead time against dispatch date', () => {
    expect(meetsCancelLeadTime('2099-12-31', 3)).toBe(true);
    expect(meetsCancelLeadTime(null, 3)).toBe(true);

    const result = getWithdrawalCancelEligibility(
      { status: 'SUBMITTED_BY_CUSTOMER', requested_dispatch_date: '2000-01-01' },
      'customer_admin',
      { deposit_cancel_lead_days: 3, withdrawal_cancel_lead_days: 3 },
    );
    expect(result.canCancel).toBe(false);
  });

  describe('getDepositRecallEligibility', () => {
    it('allows recall while awaiting admin review', () => {
      expect(getDepositRecallEligibility({ status: 'SUBMITTED_BY_CUSTOMER' }, 'customer_user').canRecall).toBe(true);
      expect(getDepositRecallEligibility({ status: 'ADMIN_REVIEWING' }, 'customer_admin').canRecall).toBe(true);
    });

    it('blocks recall once the work order has opened (WAREHOUSE_RECEIVING and beyond)', () => {
      const result = getDepositRecallEligibility({ status: 'WAREHOUSE_RECEIVING' }, 'customer_user');
      expect(result.canRecall).toBe(false);
      expect(result.reasonKey).toBe('customer_request_recall_status_denied');
    });

    it('blocks recall for an already-editable DRAFT (nothing to recall)', () => {
      expect(getDepositRecallEligibility({ status: 'DRAFT' }, 'customer_user').canRecall).toBe(false);
    });

    it('denies non-customer, non-admin roles', () => {
      const result = getDepositRecallEligibility({ status: 'ADMIN_REVIEWING' }, 'warehouse_staff');
      expect(result.canRecall).toBe(false);
      expect(result.reasonKey).toBe('customer_request_recall_role_denied');
    });

    it('lets admin recall the same eligible statuses', () => {
      expect(getDepositRecallEligibility({ status: 'ADMIN_REVIEWING' }, 'admin').canRecall).toBe(true);
      expect(getDepositRecallEligibility({ status: 'WAREHOUSE_RECEIVING' }, 'admin').canRecall).toBe(false);
    });
  });
});
