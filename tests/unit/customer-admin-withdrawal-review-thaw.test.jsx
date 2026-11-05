import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// TGC staff tick "ละลาย" per line on the admin review page; the line then
// bills THAW per kg of its picked weight.

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: () => ({}),
}));

vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const setWithdrawalLineThaw = vi.fn().mockResolvedValue({
  data: { id: 'line-1', requires_thaw: true, by_email: 'staff@tgc.test', at: '2026-11-05T07:00:00Z' },
  error: null,
});

vi.mock('../../src/services/customerWithdrawalRequestService.js', () => ({
  listCustomerWithdrawalRequests: vi.fn().mockResolvedValue({
    data: [{
      id: 'wr-1', withdrawal_no: 'CWR-20261105-0002', customer_id: 'cust-1', status: 'WAREHOUSE_PICKING',
      created_at: '2026-11-05T00:00:00Z', requested_dispatch_date: '2026-11-05', customer: { customer_name: 'Test Co' },
    }],
    error: null,
  }),
  listCustomerWithdrawalRequestLines: vi.fn().mockResolvedValue({
    data: [{
      id: 'line-1', line_no: 1, customer_product_code: 'SPC112', product_name: 'เศษตัดแต่งจากสามชั้น',
      requested_boxes: 16, requested_weight: 156, requires_thaw: false,
    }],
    error: null,
  }),
  listWithdrawalR3PermitItems: vi.fn().mockResolvedValue({ data: [], error: null }),
  setWithdrawalLineThaw,
}));

const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');

describe('CustomerAdminWithdrawalReviewPage ละลาย per line', () => {
  it('saves the tick for that line and shows who set it', async () => {
    render(<MemoryRouter><CustomerAdminWithdrawalReviewPage /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));

    const checkbox = await screen.findByTestId('admin-withdrawal-line-thaw-line-1');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);

    await waitFor(() => expect(setWithdrawalLineThaw).toHaveBeenCalledWith('line-1', true));
    await waitFor(() => expect(screen.getByTestId('admin-withdrawal-line-thaw-line-1')).toBeChecked());
    expect(screen.getByText('staff@tgc.test')).toBeInTheDocument();
  });
});
