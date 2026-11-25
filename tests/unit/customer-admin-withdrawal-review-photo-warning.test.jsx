import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Web withdrawal review: confirming dispatch without a goods-on-truck photo
// asks first (the handheld requires the photo; the web only warns).

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: () => ({}),
}));
vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const HEADER = {
  id: 'wr-1', withdrawal_no: 'CWR-20261125-0001', customer_id: 'cust-1',
  status: 'WAREHOUSE_PICKING', created_at: '2026-11-25T03:00:00Z',
  requested_dispatch_date: new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10), customer: { customer_name: 'Test Co' },
};
const LINES = [{
  id: 'line-1', line_no: 1, customer_product_code: 'P1', product_name: 'Product 1',
  requested_boxes: 10, requested_weight: 100, picked_boxes: 10, picked_weight: 100,
}];

async function openConfirm(photos) {
  vi.resetModules();
  const review = vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' }, error: null });
  vi.doMock('../../src/features/auth/UserRoleProvider.jsx', () => ({
    useUserRole: () => ({ role: 'warehouse_admin', ready: true }),
  }));
  vi.doMock('../../src/services/customerWithdrawalRequestService.js', () => ({
    listCustomerWithdrawalRequests: vi.fn().mockResolvedValue({ data: [HEADER], error: null }),
    listCustomerWithdrawalRequestLines: vi.fn().mockResolvedValue({ data: LINES, error: null }),
    reviewCustomerWithdrawalRequest: review,
    cancelCustomerWithdrawalRequest: vi.fn(),
    enqueueCustomerWithdrawalNotification: vi.fn(),
    recordWithdrawalLinePick: vi.fn(),
    updateWithdrawalLineAdminNote: vi.fn(),
    updateWithdrawalLineSource: vi.fn(),
    addAdminWithdrawalRequestLine: vi.fn(),
    listWithdrawalR3PermitItems: vi.fn().mockResolvedValue({ data: [], error: null }),
    replaceWithdrawalR3PermitItems: vi.fn(),
  }));
  vi.doMock('../../src/services/customerDocumentAttachmentService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    listWithdrawalDispatchPhotos: vi.fn().mockResolvedValue({ data: photos, error: null }),
    listCustomerDocumentAttachments: vi.fn().mockResolvedValue({ data: [], error: null }),
    getCustomerDocumentAttachmentUrls: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }));
  const { CustomerAdminWithdrawalReviewPage } = await import('../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
  render(<MemoryRouter><CustomerAdminWithdrawalReviewPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('admin-withdrawal-review-select-wr-1'));
  // Requested date is today, so confirming skips the date picker.
  fireEvent.click(await screen.findByTestId('btn-confirm-withdrawal'));
  return review;
}

describe('CustomerAdminWithdrawalReviewPage dispatch photo warning', () => {
  afterEach(() => {
    window.confirm.mockRestore?.();
    vi.doUnmock('../../src/features/auth/UserRoleProvider.jsx');
    vi.doUnmock('../../src/services/customerDocumentAttachmentService.js');
  });

  it('asks before confirming without a goods photo, and stops when staff cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const review = await openConfirm([]);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(confirmSpy.mock.calls[0][0]).toContain('ยังไม่มีรูปสินค้าบนรถ');
    expect(review).not.toHaveBeenCalled();
  });

  it('confirms anyway when staff accept the warning', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const review = await openConfirm([{ id: 'p1', photo_category: 'VEHICLE_PLATE' }]);
    await waitFor(() => expect(review).toHaveBeenCalledWith('wr-1', 'CONFIRM_DISPATCH', expect.anything(), null));
  });

  it('does not ask when the goods photo is there', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const review = await openConfirm([{ id: 'p1', photo_category: 'GOODS_ON_TRUCK' }]);
    await waitFor(() => expect(review).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
