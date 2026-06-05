import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validDocumentId = '11111111-1111-4111-8111-111111111111';
const validLineId = '22222222-2222-4222-8222-222222222222';
const validReservationId = '33333333-3333-4333-8333-333333333333';

const documentDetail = {
  document: {
    id: validDocumentId,
    document_no: 'OB-14V-001',
    status: 'RESERVED',
    customer_id: 'customer-1',
    requested_ship_date: '2026-06-04',
    created_at: '2026-06-04T09:00:00Z',
  },
  lines: [
    {
      id: validLineId,
      product_id: 'product-1',
      lot_id: 'lot-1',
      requested_quantity: 5,
      picked_quantity: 1,
      status: 'RESERVED',
    },
  ],
  reservations: [
    {
      id: validReservationId,
      outbound_line_id: validLineId,
      location_id: 'location-1',
      status: 'ACTIVE',
    },
  ],
};

const {
  confirmOutboundPickDraft,
  getOutboundDocumentDetail,
} = vi.hoisted(() => ({
  confirmOutboundPickDraft: vi.fn(),
  getOutboundDocumentDetail: vi.fn(async () => documentDetail),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  confirmOutboundPickDraft: (...args) => confirmOutboundPickDraft(...args),
  getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
}));

import { PickingDraftWorkflowPage } from '../../src/features/operations/picking/PickingDraftWorkflowPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <PickingDraftWorkflowPage />
    </MemoryRouter>,
  );
}

async function loadDocumentDetail() {
  fireEvent.change(screen.getByLabelText('Picking outbound document id'), { target: { value: validDocumentId } });
  fireEvent.click(screen.getByRole('button', { name: 'Load Document Detail' }));
  await waitFor(() => {
    expect(getOutboundDocumentDetail).toHaveBeenCalledWith(validDocumentId);
  });
  expect(await screen.findByText('OB-14V-001')).toBeInTheDocument();
}

function fillValidPickForm() {
  fireEvent.change(screen.getByLabelText('Pick confirmation outbound line id'), { target: { value: validLineId } });
  fireEvent.change(screen.getByLabelText('Pick confirmation reservation id'), { target: { value: validReservationId } });
  fireEvent.change(screen.getByLabelText('Pick confirmation picked quantity'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Pick confirmation picked weight'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Pick confirmation pick reference'), { target: { value: 'PICK-REF-14V-001' } });
}

beforeEach(() => {
  confirmOutboundPickDraft.mockReset();
  getOutboundDocumentDetail.mockReset();
  getOutboundDocumentDetail.mockImplementation(async () => documentDetail);
  confirmOutboundPickDraft.mockResolvedValue({
    status: 'PICKED_PARTIAL',
    outbound_document_id: validDocumentId,
    outbound_line_id: validLineId,
    reservation_id: validReservationId,
    picked_quantity: 2,
    line_picked_quantity: 3,
    reservation_status: 'ACTIVE',
  });
});

describe('Sprint 14V controlled pick confirmation UI draft', () => {
  it('renders safety note and controlled pick confirmation section', () => {
    renderPage();

    expect(screen.getByText('Confirm Pick updates outbound picking state only. No stock posting. No stock movement OUT. No stock balance update.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Controlled Pick Confirmation Draft' })).toBeInTheDocument();
  });

  it('renders line, reservation, quantity, and reference inputs', () => {
    renderPage();

    expect(screen.getByLabelText('Pick confirmation outbound line id')).toBeInTheDocument();
    expect(screen.getByLabelText('Pick confirmation reservation id')).toBeInTheDocument();
    expect(screen.getByLabelText('Pick confirmation picked quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Pick confirmation pick reference')).toBeInTheDocument();
  });

  it('shows validation errors for missing required fields', async () => {
    renderPage();
    await loadDocumentDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Outbound line ID is required.');
    expect(confirmOutboundPickDraft).not.toHaveBeenCalled();
  });

  it('invalid UUID does not call confirmOutboundPickDraft', async () => {
    renderPage();
    await loadDocumentDetail();

    fireEvent.change(screen.getByLabelText('Pick confirmation outbound line id'), { target: { value: 'not-a-uuid' } });
    fireEvent.change(screen.getByLabelText('Pick confirmation reservation id'), { target: { value: validReservationId } });
    fireEvent.change(screen.getByLabelText('Pick confirmation picked quantity'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Pick confirmation pick reference'), { target: { value: 'PICK-REF-14V-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Outbound line ID must be a valid UUID.');
    expect(confirmOutboundPickDraft).not.toHaveBeenCalled();
  });

  it('picked_quantity <= 0 does not call confirmOutboundPickDraft', async () => {
    renderPage();
    await loadDocumentDetail();
    fillValidPickForm();
    fireEvent.change(screen.getByLabelText('Pick confirmation picked quantity'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Picked quantity must be greater than 0.');
    expect(confirmOutboundPickDraft).not.toHaveBeenCalled();
  });

  it('missing pick_reference does not call confirmOutboundPickDraft', async () => {
    renderPage();
    await loadDocumentDetail();
    fillValidPickForm();
    fireEvent.change(screen.getByLabelText('Pick confirmation pick reference'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick reference is required for idempotency.');
    expect(confirmOutboundPickDraft).not.toHaveBeenCalled();
  });

  it('successful confirm calls confirmOutboundPickDraft and reloads document detail', async () => {
    renderPage();
    await loadDocumentDetail();
    fillValidPickForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    await waitFor(() => {
      expect(confirmOutboundPickDraft).toHaveBeenCalledWith({
        outboundDocumentId: validDocumentId,
        outboundLineId: validLineId,
        reservationId: validReservationId,
        pickedQuantity: 2,
        pickedWeight: 0,
        pickReference: 'PICK-REF-14V-001',
        note: null,
      });
    });

    expect(await screen.findByText('Pick confirmation draft saved.')).toBeInTheDocument();
    expect(screen.getByText(/PICKED_PARTIAL/)).toBeInTheDocument();
    expect(getOutboundDocumentDetail).toHaveBeenCalledTimes(2);
  });

  it('shows friendly message on service error', async () => {
    confirmOutboundPickDraft.mockRejectedValueOnce(new Error('RELEASED reservation cannot be picked'));
    renderPage();
    await loadDocumentDetail();
    fillValidPickForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save Pick Confirmation Draft' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to confirm pick draft. Please check reservation status, quantities, or permission.');
    expect(alert).not.toHaveTextContent('RELEASED reservation cannot be picked');
  });

  it('does not render unsafe action buttons', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('source avoids dangerous code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/features/operations/picking/PickingDraftWorkflowPage.jsx',
      'src/services/outboundPickingService.js',
    ];
    const source = sourcePaths
      .map((sourcePath) => fs.readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'))
      .join('\n');

    expect(source).toContain('postOutboundDocumentDraft');
    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/delete\s+from/i);
    expect(source).not.toMatch(/\btruncate\b/i);
  });
});
