import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "ขึ้นของเสร็จ" on the handheld: loading cannot be closed until there is at
// least one photo of the goods on the truck and the receiving driver's name.

const listPhotos = vi.fn();
const setTransport = vi.fn();

vi.mock('../../src/services/customerDocumentAttachmentService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listWithdrawalDispatchPhotos: (...args) => listPhotos(...args),
    getCustomerDocumentAttachmentUrls: async () => ({ data: {}, error: null }),
    uploadCustomerDocumentAttachments: vi.fn(async () => ({ data: [], error: null })),
    deleteCustomerDocumentAttachment: vi.fn(async () => ({ data: null, error: null })),
  };
});

vi.mock('../../src/services/transportInfoService.js', () => ({
  getDocumentTransportInfo: async () => ({ data: { seal_no: null, driver_name: null }, error: null }),
  setDocumentTransportInfo: (...args) => setTransport(...args),
}));

vi.mock('../../src/hooks/useOnlineStatus.js', () => ({ useOnlineStatus: () => true }));

const { hasRequiredDispatchPhotos } = await import('../../src/services/customerDocumentAttachmentService.js');
const { DispatchConfirmSheet } = await import('../../src/features/handheld/DispatchConfirmSheet.jsx');

const doc = { id: 'wd-1', customer_id: 'c-1', withdrawal_no: 'CWR-20261124-0010' };

describe('hasRequiredDispatchPhotos', () => {
  it('needs a goods-on-truck photo; plate and seal are optional', () => {
    expect(hasRequiredDispatchPhotos([])).toBe(false);
    expect(hasRequiredDispatchPhotos([{ photo_category: 'VEHICLE_PLATE' }])).toBe(false);
    expect(hasRequiredDispatchPhotos([{ photo_category: 'GOODS_ON_TRUCK' }])).toBe(true);
  });
});

describe('DispatchConfirmSheet', () => {
  beforeEach(() => {
    listPhotos.mockReset();
    setTransport.mockReset();
  });

  it('keeps confirm disabled without a goods photo even when the driver is filled in', async () => {
    listPhotos.mockResolvedValue({ data: [{ id: 'p1', photo_category: 'VEHICLE_PLATE' }], error: null });
    render(<DispatchConfirmSheet doc={doc} activeProfile={{ id: 'u1' }} onClose={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.change(screen.getByTestId('dispatch-driver-name'), { target: { value: 'สมชาย' } });
    await waitFor(() => expect(listPhotos).toHaveBeenCalled());
    expect(screen.getByTestId('dispatch-confirm-button')).toBeDisabled();
    expect(screen.getByText(/ยังขาด: รูปสินค้าบนรถ/)).toBeInTheDocument();
  });

  it('saves driver + seal, then records the finish time and closes', async () => {
    listPhotos.mockResolvedValue({ data: [{ id: 'p1', photo_category: 'GOODS_ON_TRUCK' }], error: null });
    setTransport.mockResolvedValue({ data: { driver_name: 'สมชาย' }, error: null });
    const onFinish = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<DispatchConfirmSheet doc={doc} activeProfile={{ id: 'u1' }} onClose={onClose} onFinish={onFinish} />);

    await waitFor(() => expect(screen.getByText('1 รูป')).toBeInTheDocument());
    expect(screen.getByTestId('dispatch-confirm-button')).toBeDisabled(); // no driver yet
    fireEvent.change(screen.getByTestId('dispatch-driver-name'), { target: { value: 'สมชาย' } });
    fireEvent.change(screen.getByTestId('dispatch-seal-no'), { target: { value: 'SL-778' } });
    fireEvent.click(screen.getByTestId('dispatch-confirm-button'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setTransport).toHaveBeenCalledWith('CUSTOMER_WITHDRAWAL_REQUEST', 'wd-1', { sealNo: 'SL-778', driverName: 'สมชาย' });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not record the finish time when saving the driver fails', async () => {
    listPhotos.mockResolvedValue({ data: [{ id: 'p1', photo_category: 'GOODS_ON_TRUCK' }], error: null });
    setTransport.mockResolvedValue({ data: null, error: new Error('permission denied') });
    const onFinish = vi.fn(async () => true);
    render(<DispatchConfirmSheet doc={doc} activeProfile={{ id: 'u1' }} onClose={vi.fn()} onFinish={onFinish} />);
    await waitFor(() => expect(screen.getByText('1 รูป')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('dispatch-driver-name'), { target: { value: 'สมชาย' } });
    fireEvent.click(screen.getByTestId('dispatch-confirm-button'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission denied'));
    expect(onFinish).not.toHaveBeenCalled();
  });
});
