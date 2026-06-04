import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createOutboundDraft,
  addOutboundLine,
  reserveOutboundStock,
  releaseOutboundReservation,
} = vi.hoisted(() => ({
  createOutboundDraft: vi.fn(async () => ({ id: 'draft-1', status: 'DRAFT' })),
  addOutboundLine: vi.fn(async () => ({ id: 'line-1', status: 'OPEN' })),
  reserveOutboundStock: vi.fn(async () => ({ id: 'reservation-1', status: 'ACTIVE' })),
  releaseOutboundReservation: vi.fn(async () => ({ id: 'reservation-1', status: 'RELEASED' })),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  createOutboundDraft: (...args) => createOutboundDraft(...args),
  addOutboundLine: (...args) => addOutboundLine(...args),
  reserveOutboundStock: (...args) => reserveOutboundStock(...args),
  releaseOutboundReservation: (...args) => releaseOutboundReservation(...args),
}));

import { OutboundDraftPage } from '../../src/features/operations/outbound/OutboundDraftPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <OutboundDraftPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  createOutboundDraft.mockClear();
  addOutboundLine.mockClear();
  reserveOutboundStock.mockClear();
  releaseOutboundReservation.mockClear();
});

describe('Sprint 14H outbound picking UI draft screens', () => {
  it('renders the safety note and no post outbound buttons', () => {
    renderPage();

    expect(screen.getByText('Draft/reserve/release only. No stock posting. No stock movement OUT. No stock balance update.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stock Movement OUT/i })).not.toBeInTheDocument();
  });

  it('create draft action calls createOutboundDraft', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Outbound document no'), { target: { value: 'OB-14H-001' } });
    fireEvent.change(screen.getByLabelText('Outbound customer id'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Outbound source document no'), { target: { value: 'WD-001' } });
    fireEvent.change(screen.getByLabelText('Outbound requested ship date'), { target: { value: '2026-06-04' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));

    await waitFor(() => {
      expect(createOutboundDraft).toHaveBeenCalledWith({
        document_no: 'OB-14H-001',
        customer_id: 'customer-1',
        source_document_no: 'WD-001',
        requested_ship_date: '2026-06-04',
      });
    });
    expect(await screen.findByText(/draft-1/)).toBeInTheDocument();
  });

  it('add line action calls addOutboundLine', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Outbound line document id'), { target: { value: 'document-1' } });
    fireEvent.change(screen.getByLabelText('Outbound line product id'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Outbound line lot id'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Outbound line requested quantity'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Outbound line requested weight'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));

    await waitFor(() => {
      expect(addOutboundLine).toHaveBeenCalledWith({
        document_id: 'document-1',
        product_id: 'product-1',
        lot_id: 'lot-1',
        requested_quantity: 5,
        requested_weight: 2.5,
      });
    });
  });

  it('reserve action calls reserveOutboundStock', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Reserve outbound document id'), { target: { value: 'document-1' } });
    fireEvent.change(screen.getByLabelText('Reserve outbound line id'), { target: { value: 'line-1' } });
    fireEvent.change(screen.getByLabelText('Reserve location id'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Reserve quantity'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Reserve weight'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reserve Stock' }));

    await waitFor(() => {
      expect(reserveOutboundStock).toHaveBeenCalledWith({
        outbound_document_id: 'document-1',
        outbound_line_id: 'line-1',
        location_id: 'location-1',
        reserved_quantity: 4,
        reserved_weight: 1.5,
      });
    });
  });

  it('release action passes reservation_id and displays the successful result', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Release reservation id'), { target: { value: 'reservation-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Release Reservation' }));

    await waitFor(() => {
      expect(releaseOutboundReservation).toHaveBeenCalledWith({
        reservation_id: 'reservation-1',
      });
    });
    expect(await screen.findByText(/RELEASED/)).toBeInTheDocument();
  });

  it('release action displays service errors', async () => {
    releaseOutboundReservation.mockRejectedValueOnce(new Error('Release RPC failed'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Release reservation id'), { target: { value: 'reservation-error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Release Reservation' }));

    await waitFor(() => {
      expect(releaseOutboundReservation).toHaveBeenCalledWith({
        reservation_id: 'reservation-error',
      });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Release RPC failed');
  });

  it('source avoids post outbound, stock mutation tables, and destructive SQL patterns', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/outbound/OutboundDraftPage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).not.toContain('tgd_rpc_post_outbound_document');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\btruncate\b/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });
});


