import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a real reported bug: the desktop admin review
// page's "ยืนยันจ่าย" (confirm dispatch) button had NO check at all that
// every line actually had a picked quantity recorded — only the handheld
// picking page's own "complete" button gated on picked_at. A live-data
// audit found 45 withdrawal requests already COMPLETED this way, with
// picked_boxes and picked_weight both still null on some or all lines.
// This locks in that the button is disabled (not just hidden — same
// show-but-disabled-with-a-reason UX as the deposit review page's own
// confirm-receiving guard) whenever any line has neither confirmed.

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: () => ({}),
}));

vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const HEADER = {
  id: 'wr-1', withdrawal_no: 'CWR-20260810-0001', customer_id: 'cust-1',
  status: 'WAREHOUSE_PICKING', created_at: '2026-08-10T00:00:00Z',
  requested_dispatch_date: '2026-08-10', customer: { customer_name: 'Test Co' },
};

function mockLines(lines) {
  vi.doMock('../../src/services/customerWithdrawalRequestService.js', () => ({
    listCustomerWithdrawalRequests: vi.fn().mockResolvedValue({ data: [HEADER], error: null }),
    listCustomerWithdrawalRequestLines: vi.fn().mockResolvedValue({ data: lines, error: null }),
    reviewCustomerWithdrawalRequest: vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' }, error: null }),
    cancelCustomerWithdrawalRequest: vi.fn(),
    enqueueCustomerWithdrawalNotification: vi.fn(),
    recordWithdrawalLinePick: vi.fn(),
    updateWithdrawalLineAdminNote: vi.fn(),
    updateWithdrawalLineSource: vi.fn(),
    addAdminWithdrawalRequestLine: vi.fn(),
  }));
}

describe('CustomerAdminWithdrawalReviewPage confirm-dispatch guard', () => {
  it('disables the confirm button when a line has neither picked_boxes nor picked_weight recorded', async () => {
    vi.resetModules();
    mockLines([{
      id: 'line-1', line_no: 1, customer_product_code: 'P1', product_name: 'Product 1',
      requested_boxes: 10, requested_weight: 100, picked_boxes: null, picked_weight: null,
    }]);

    const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
    render(<CustomerAdminWithdrawalReviewPage />);

    fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));

    const button = await screen.findByTestId('btn-confirm-withdrawal');
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('enables the confirm button once every line has at least boxes or weight picked', async () => {
    vi.resetModules();
    mockLines([
      { id: 'line-1', line_no: 1, customer_product_code: 'P1', product_name: 'Product 1', requested_boxes: 10, requested_weight: 100, picked_boxes: 10, picked_weight: 100 },
      // weight-only pick is a legitimate real pick, not "unconfirmed".
      { id: 'line-2', line_no: 2, customer_product_code: 'P2', product_name: 'Product 2', requested_boxes: 5, requested_weight: 50, picked_boxes: null, picked_weight: 50 },
    ]);

    const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
    render(<CustomerAdminWithdrawalReviewPage />);

    fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));

    const button = await screen.findByTestId('btn-confirm-withdrawal');
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
