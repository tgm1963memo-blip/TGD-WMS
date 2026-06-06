import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

const {
  addOutboundLine,
  confirmOutboundPickDraft,
  createOutboundDraft,
  getOutboundDocumentDetail,
  releaseOutboundReservation,
  reserveOutboundStock,
} = vi.hoisted(() => ({
  addOutboundLine: vi.fn(),
  confirmOutboundPickDraft: vi.fn(),
  createOutboundDraft: vi.fn(),
  getOutboundDocumentDetail: vi.fn(async () => ({
    document: {
      id: 'document-1',
      document_no: 'OB-14O-001',
      status: 'RESERVED',
      customer_id: 'customer-1',
      requested_ship_date: '2026-06-04',
      created_at: '2026-06-04T09:00:00Z',
    },
    lines: [
      {
        id: 'line-1',
        product_id: 'product-1',
        lot_id: 'lot-1',
        requested_quantity: 5,
        picked_quantity: 0,
        status: 'RESERVED',
      },
    ],
    reservations: [
      {
        id: 'reservation-1',
        outbound_line_id: 'line-1',
        location_id: 'location-1',
        status: 'ACTIVE',
      },
    ],
  })),
  releaseOutboundReservation: vi.fn(),
  reserveOutboundStock: vi.fn(),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  addOutboundLine: (...args) => addOutboundLine(...args),
  confirmOutboundPickDraft: (...args) => confirmOutboundPickDraft(...args),
  createOutboundDraft: (...args) => createOutboundDraft(...args),
  getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
  releaseOutboundReservation: (...args) => releaseOutboundReservation(...args),
  reserveOutboundStock: (...args) => reserveOutboundStock(...args),
}));

import { PickingDraftWorkflowPage } from '../../src/features/operations/picking/PickingDraftWorkflowPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <PickingDraftWorkflowPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addOutboundLine.mockClear();
  confirmOutboundPickDraft.mockClear();
  createOutboundDraft.mockClear();
  getOutboundDocumentDetail.mockClear();
  releaseOutboundReservation.mockClear();
  reserveOutboundStock.mockClear();
});

describe('Sprint 14O picking workflow draft UI', () => {
  it('renders safety note and document id input', () => {
    renderPage();

    expect(screen.getByText('Picking draft workflow only. No stock posting. No stock movement OUT. No stock balance update.')).toBeInTheDocument();
    expect(screen.getByLabelText('Picking outbound document id')).toBeInTheDocument();
  });

  it('loads outbound document detail and renders document, lines, and reservations', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Picking outbound document id'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load Document Detail' }));

    await waitFor(() => {
      expect(getOutboundDocumentDetail).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    });

    expect(await screen.findByText('OB-14O-001')).toBeInTheDocument();
    expect(screen.getByText('product-1')).toBeInTheDocument();
    expect(screen.getByText('lot-1')).toBeInTheDocument();
    expect(screen.getByText('location-1')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('keeps manual picking note local-only without database mutation calls', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Picking local note'), { target: { value: 'Check pallet labels before UAT.' } });

    expect(screen.getByLabelText('Picking local note')).toHaveValue('Check pallet labels before UAT.');
    expect(createOutboundDraft).not.toHaveBeenCalled();
    expect(addOutboundLine).not.toHaveBeenCalled();
    expect(reserveOutboundStock).not.toHaveBeenCalled();
    expect(releaseOutboundReservation).not.toHaveBeenCalled();
  });

  it('sidebar navigation includes picking confirmation route', () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    // 17B: navigation restructured – 'Picking Confirmation' links to picking
    // Picking Draft route still exists but is no longer a sidebar item
    const pickingLink = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/operations/picking');

    expect(pickingLink).toBeTruthy();
  });

  it('does not render forbidden picking or outbound destructive actions', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Pick/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('source avoids outbound posting and dangerous stock mutation code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/app/routes.jsx',
      'src/app/navigation.js',
      'src/components/layout/Sidebar.jsx',
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
