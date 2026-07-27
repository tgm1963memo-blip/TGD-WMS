import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression coverage for the new RPC parameters added alongside the ร.3
// document-fee checkbox (deposit/withdrawal requests) and the Facility
// Usage service-rate picker — confirms each JS service wrapper actually
// forwards the new field to its RPC under the exact p_* name the SQL
// migration declares, since a silent drop here would mean the checkbox/
// dropdown in the UI has no effect at all.

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: vi.fn(), rpc: rpcMock },
}));

const {
  createCustomerDepositRequest,
  updateCustomerDepositRequestDraft,
} = await import('../../src/services/customerDepositRequestService.js');
const {
  createCustomerWithdrawalRequest,
  updateCustomerWithdrawalRequestDraft,
} = await import('../../src/services/customerWithdrawalRequestService.js');
const { createCustomerFacilityUsageRequest } = await import('../../src/services/customerFacilityUsageService.js');

describe('requires_r3_document / service_rate_id RPC param wiring', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: 'req-1' }, error: null });
  });

  it('createCustomerDepositRequest forwards requiresR3Document as p_requires_r3_document', async () => {
    await createCustomerDepositRequest({
      expectedArrivalDate: '2026-07-01', contactName: 'A', contactPhone: '08', requiresR3Document: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('tgd_create_customer_deposit_request', expect.objectContaining({
      p_requires_r3_document: true,
    }));
  });

  it('createCustomerDepositRequest defaults to false when omitted', async () => {
    await createCustomerDepositRequest({ expectedArrivalDate: '2026-07-01', contactName: 'A', contactPhone: '08' });
    expect(rpcMock).toHaveBeenCalledWith('tgd_create_customer_deposit_request', expect.objectContaining({
      p_requires_r3_document: false,
    }));
  });

  it('updateCustomerDepositRequestDraft forwards requiresR3Document', async () => {
    await updateCustomerDepositRequestDraft('req-1', {
      expectedArrivalDate: '2026-07-01', contactName: 'A', contactPhone: '08', requiresR3Document: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('tgd_update_customer_deposit_request_draft', expect.objectContaining({
      p_requires_r3_document: true,
    }));
  });

  it('createCustomerWithdrawalRequest forwards requiresR3Document as p_requires_r3_document', async () => {
    await createCustomerWithdrawalRequest({
      requestedDispatchDate: '2026-07-01', deliveryType: 'PICKUP', pickupContact: 'A', destination: 'BKK',
      requiresR3Document: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('tgd_create_customer_withdrawal_request', expect.objectContaining({
      p_requires_r3_document: true,
    }));
  });

  it('updateCustomerWithdrawalRequestDraft forwards requiresR3Document', async () => {
    await updateCustomerWithdrawalRequestDraft('req-1', {
      requestedDispatchDate: '2026-07-01', deliveryType: 'PICKUP', pickupContact: 'A', destination: 'BKK',
      requiresR3Document: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('tgd_update_customer_withdrawal_request_draft', expect.objectContaining({
      p_requires_r3_document: true,
    }));
  });

  it('createCustomerFacilityUsageRequest forwards serviceRateId as p_service_rate_id', async () => {
    await createCustomerFacilityUsageRequest({ serviceRateId: 'rate-1', durationHours: 2 });
    expect(rpcMock).toHaveBeenCalledWith('tgd_create_customer_facility_usage_request', expect.objectContaining({
      p_service_rate_id: 'rate-1',
    }));
  });

  it('createCustomerFacilityUsageRequest sends null service rate when none selected', async () => {
    await createCustomerFacilityUsageRequest({ durationHours: 2 });
    expect(rpcMock).toHaveBeenCalledWith('tgd_create_customer_facility_usage_request', expect.objectContaining({
      p_service_rate_id: null,
    }));
  });
});
