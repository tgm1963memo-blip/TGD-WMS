import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Handheld receiving: staff can record the seal number and the driver's name
// on the deposit (both optional), same data as the admin review page.

const getInfo = vi.fn();
const setInfo = vi.fn();
vi.mock('../../src/services/transportInfoService.js', () => ({
  getDocumentTransportInfo: (...a) => getInfo(...a),
  setDocumentTransportInfo: (...a) => setInfo(...a),
}));

const { TransportInfoCard } = await import('../../src/features/handheld/TransportInfoCard.jsx');

describe('TransportInfoCard', () => {
  beforeEach(() => { getInfo.mockReset(); setInfo.mockReset(); });

  it('shows saved values and only enables save after a change', async () => {
    getInfo.mockResolvedValue({ data: { seal_no: 'SL-1', driver_name: 'สมชาย' }, error: null });
    render(<TransportInfoCard documentType="CUSTOMER_DEPOSIT_REQUEST" requestId="dep-1" />);
    await waitFor(() => expect(screen.getByTestId('handheld-transport-driver')).toHaveValue('สมชาย'));
    expect(screen.getByTestId('handheld-transport-seal')).toHaveValue('SL-1');
    expect(screen.getByTestId('handheld-transport-save')).toBeDisabled();
    fireEvent.change(screen.getByTestId('handheld-transport-seal'), { target: { value: 'SL-2' } });
    expect(screen.getByTestId('handheld-transport-save')).toBeEnabled();
  });

  it('saves to the deposit and shows it was saved', async () => {
    getInfo.mockResolvedValue({ data: { seal_no: null, driver_name: null }, error: null });
    setInfo.mockResolvedValue({ data: { seal_no: 'SL-9', driver_name: 'สมหญิง' }, error: null });
    render(<TransportInfoCard documentType="CUSTOMER_DEPOSIT_REQUEST" requestId="dep-1" />);
    await waitFor(() => expect(screen.getByTestId('handheld-transport-driver')).toBeEnabled());
    fireEvent.change(screen.getByTestId('handheld-transport-driver'), { target: { value: 'สมหญิง' } });
    fireEvent.change(screen.getByTestId('handheld-transport-seal'), { target: { value: 'SL-9' } });
    fireEvent.click(screen.getByTestId('handheld-transport-save'));
    await waitFor(() => expect(screen.getByText('บันทึกแล้ว')).toBeInTheDocument());
    expect(setInfo).toHaveBeenCalledWith('CUSTOMER_DEPOSIT_REQUEST', 'dep-1', { sealNo: 'SL-9', driverName: 'สมหญิง' });
  });

  it('shows the error when saving fails', async () => {
    getInfo.mockResolvedValue({ data: { seal_no: null, driver_name: null }, error: null });
    setInfo.mockResolvedValue({ data: null, error: new Error('permission denied') });
    render(<TransportInfoCard documentType="CUSTOMER_DEPOSIT_REQUEST" requestId="dep-1" />);
    await waitFor(() => expect(screen.getByTestId('handheld-transport-driver')).toBeEnabled());
    fireEvent.change(screen.getByTestId('handheld-transport-driver'), { target: { value: 'ก' } });
    fireEvent.click(screen.getByTestId('handheld-transport-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied');
  });

  it('hides itself when the database does not have the columns yet', async () => {
    getInfo.mockResolvedValue({ data: {}, error: null, unavailable: true });
    const { container } = render(<TransportInfoCard documentType="CUSTOMER_DEPOSIT_REQUEST" requestId="dep-1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
