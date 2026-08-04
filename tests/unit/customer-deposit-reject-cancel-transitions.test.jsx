import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a real reported bug: staff filled in a reject
// reason on a deposit request already accepted into a work order
// (WAREHOUSE_RECEIVING) and clicking "ปฏิเสธคำขอ" always failed, because
// tgd_review_customer_deposit_request's REJECT transition only accepts it
// from ADMIN_REVIEWING - the button was shown (and let staff fill in a
// reason) for a much broader set of statuses than the RPC actually allows.
// The fix: only show Reject where it can actually succeed, and expose the
// separate Cancel action (which the RPC does allow from this status) for
// everything already accepted into a work order.
const reviewMock = vi.fn().mockResolvedValue({ data: { status: 'ADMIN_REJECTED' }, error: null });
const cancelMock = vi.fn().mockResolvedValue({ data: { status: 'CANCELLED' }, error: null });

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  getCustomerDepositRequest: vi.fn((id) => Promise.resolve({
    data: {
      id,
      request_no: 'CDR-20260803-0002',
      customer_id: 'cust-1',
      status: id === 'req-reviewing' ? 'ADMIN_REVIEWING' : 'WAREHOUSE_RECEIVING',
      expected_arrival_date: '2026-08-03',
      contact_name: 'Somchai',
      goods_temp: null,
    },
  })),
  listCustomerDepositRequestLines: vi.fn().mockResolvedValue({ data: [] }),
  reviewCustomerDepositRequest: reviewMock,
  cancelCustomerDepositRequest: cancelMock,
  recordDepositLineActualReceipt: vi.fn(),
  updateDepositLineLocation: vi.fn(),
  enqueueCustomerDepositNotification: vi.fn(),
}));

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/services/warehouseLayoutService.js', () => ({
  getActiveLocations: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('../../src/services/inventoryMovementService.js', () => ({
  checkLocationHasInventory: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: vi.fn().mockResolvedValue({ data: [{ id: 'cust-1', customer_name: 'Test Co', address: '-', fax: '-' }] }),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn().mockResolvedValue({ data: [] }),
}));

const { CustomerDepositDetailModal } = await import('../../src/components/customer/CustomerDepositDetailModal.jsx');

describe('CustomerDepositDetailModal reject vs cancel transitions', () => {
  it('shows Cancel (not Reject) once the request is already accepted into a work order, and calls cancelCustomerDepositRequest', async () => {
    render(
      <CustomerDepositDetailModal requestId="req-warehouse-receiving" isOpen onClose={() => {}} onStatusChange={() => {}} />
    );

    const cancelButton = await screen.findByRole('button', { name: 'ยกเลิกคำขอ' });
    expect(screen.queryByRole('button', { name: 'ปฏิเสธคำขอ' })).not.toBeInTheDocument();

    fireEvent.click(cancelButton);
    const reasonInput = await screen.findByPlaceholderText('เช่น ลูกค้าแจ้งให้ยกเลิก');
    fireEvent.change(reasonInput, { target: { value: 'ลูกค้าแจ้งให้ยกเลิก' } });

    const confirmButtons = screen.getAllByRole('button', { name: 'ยกเลิกคำขอ' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith('req-warehouse-receiving', 'ลูกค้าแจ้งให้ยกเลิก'));
  });

  it('still shows Reject (not Cancel) while a request is at ADMIN_REVIEWING', async () => {
    render(
      <CustomerDepositDetailModal requestId="req-reviewing" isOpen onClose={() => {}} onStatusChange={() => {}} />
    );

    await screen.findByRole('button', { name: 'ปฏิเสธคำขอ' });
    expect(screen.queryByRole('button', { name: 'ยกเลิกคำขอ' })).not.toBeInTheDocument();
  });
});
