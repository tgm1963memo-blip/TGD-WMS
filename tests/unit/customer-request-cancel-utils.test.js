import { describe, expect, it } from 'vitest';
import {
  getDepositCancelEligibility,
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
});
