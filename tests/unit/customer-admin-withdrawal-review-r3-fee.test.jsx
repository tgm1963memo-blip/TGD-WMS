import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// TGC staff can tick "คิดค่าบริการเอกสาร ร.3" on the admin review page at any
// non-cancelled status — requires_r3_document is what bills the R3_DOCUMENT fee.

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: () => ({}),
}));

vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const setWithdrawalR3Document = vi.fn().mockResolvedValue({
  data: { id: 'wr-1', requires_r3_document: true, by_email: 'staff@tgc.test', at: '2026-11-05T07:00:00Z' },
  error: null,
});

function mockService(status) {
  vi.doMock('../../src/services/customerWithdrawalRequestService.js', () => ({
    listCustomerWithdrawalRequests: vi.fn().mockResolvedValue({
      data: [{
        id: 'wr-1', withdrawal_no: 'CWR-20261105-0002', customer_id: 'cust-1', status,
        created_at: '2026-11-05T00:00:00Z', requested_dispatch_date: '2026-11-05',
        requires_r3_document: false, customer: { customer_name: 'Test Co' },
      }],
      error: null,
    }),
    listCustomerWithdrawalRequestLines: vi.fn().mockResolvedValue({ data: [], error: null }),
    listWithdrawalR3PermitItems: vi.fn().mockResolvedValue({ data: [], error: null }),
    replaceWithdrawalR3PermitItems: vi.fn(),
    setWithdrawalR3Document,
  }));
}

describe('CustomerAdminWithdrawalReviewPage ร.3 fee checkbox', () => {
  it('lets staff tick ร.3 after the customer submitted, and shows who set it', async () => {
    vi.resetModules();
    mockService('WAREHOUSE_PICKING');
    const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
    render(<MemoryRouter><CustomerAdminWithdrawalReviewPage /></MemoryRouter>);

    fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));
    const checkbox = await screen.findByTestId('admin-withdrawal-r3-fee-checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    await waitFor(() => expect(setWithdrawalR3Document).toHaveBeenCalledWith('wr-1', true));
    await waitFor(() => expect(screen.getByTestId('admin-withdrawal-r3-fee-checkbox')).toBeChecked());
    expect(screen.getByText(/staff@tgc\.test/)).toBeInTheDocument();
    // Ticking it also opens the ร.3 permit panel for the kg comparison.
    expect(screen.getByTestId('withdrawal-r3-permit-panel')).toBeInTheDocument();
  });

  it('shows no checkbox on a cancelled request', async () => {
    vi.resetModules();
    mockService('CANCELLED');
    const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
    render(<MemoryRouter><CustomerAdminWithdrawalReviewPage /></MemoryRouter>);

    fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));
    await screen.findByTestId('admin-withdrawal-r3-attachment-panel');
    expect(screen.queryByTestId('admin-withdrawal-r3-fee-checkbox')).toBeNull();
  });
});
