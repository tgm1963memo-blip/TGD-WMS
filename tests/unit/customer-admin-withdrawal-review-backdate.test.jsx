import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Admin keys in requests after the goods already left (e.g. dispatched 18/09,
// keyed in 08/10), so the confirm-dispatch date picker must let admin pick a
// day before the request was created. Every other role keeps the
// created-date floor, matching tgd_review_customer_withdrawal_request
// (20261008090000).

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: () => ({}),
}));

vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const HEADER = {
  id: 'wr-1', withdrawal_no: 'CWR-20261008-0010', customer_id: 'cust-1',
  status: 'WAREHOUSE_PICKING', created_at: '2026-10-08T03:00:00Z',
  requested_dispatch_date: '2026-09-18', customer: { customer_name: 'Test Co' },
};

const LINES = [{
  id: 'line-1', line_no: 1, customer_product_code: 'P1', product_name: 'Product 1',
  requested_boxes: 10, requested_weight: 100, picked_boxes: 10, picked_weight: 100,
}];

async function renderAs(role) {
  vi.resetModules();
  vi.doMock('../../src/features/auth/UserRoleProvider.jsx', () => ({
    useUserRole: () => ({ role, ready: true }),
  }));
  vi.doMock('../../src/services/customerWithdrawalRequestService.js', () => ({
    listCustomerWithdrawalRequests: vi.fn().mockResolvedValue({ data: [HEADER], error: null }),
    listCustomerWithdrawalRequestLines: vi.fn().mockResolvedValue({ data: LINES, error: null }),
    reviewCustomerWithdrawalRequest: vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' }, error: null }),
    cancelCustomerWithdrawalRequest: vi.fn(),
    enqueueCustomerWithdrawalNotification: vi.fn(),
    recordWithdrawalLinePick: vi.fn(),
    updateWithdrawalLineAdminNote: vi.fn(),
    updateWithdrawalLineSource: vi.fn(),
    addAdminWithdrawalRequestLine: vi.fn(),
  }));
  const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
  render(<CustomerAdminWithdrawalReviewPage />);
  fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));
  fireEvent.click(await screen.findByTestId('btn-confirm-withdrawal'));
  return screen.findByTestId('input-confirm-withdrawal-date');
}

describe('CustomerAdminWithdrawalReviewPage confirm-dispatch backdating', () => {
  afterEach(() => {
    vi.doUnmock('../../src/features/auth/UserRoleProvider.jsx');
  });

  it('lets admin confirm on the requested day even though it is before the request was created', async () => {
    const input = await renderAs('admin');
    expect(input).toHaveValue('2026-09-18');
    expect(input).not.toHaveAttribute('min');
    expect(screen.getByTestId('btn-confirm-withdrawal-date')).not.toBeDisabled();
  });

  it('keeps the created-date floor for non-admin roles', async () => {
    const input = await renderAs('warehouse_admin');
    expect(input).toHaveValue('2026-10-08');
    expect(input).toHaveAttribute('min', '2026-10-08');
    fireEvent.change(input, { target: { value: '2026-09-18' } });
    expect(screen.getByTestId('btn-confirm-withdrawal-date')).toBeDisabled();
  });
});
