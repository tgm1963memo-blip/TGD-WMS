import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOutboundDocumentDetail,
  listOutboundDocuments,
} = vi.hoisted(() => ({
  listOutboundDocuments: vi.fn(async () => ([
    {
      id: 'document-1',
      document_no: 'OB-14J-001',
      status: 'RESERVED',
      customer_id: 'customer-1',
      requested_ship_date: '2026-06-04',
      created_at: '2026-06-04T09:00:00Z',
    },
  ])),
  getOutboundDocumentDetail: vi.fn(async () => ({
    document: {
      id: 'document-1',
      document_no: 'OB-14J-001',
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
        requested_weight: 1.25,
        picked_quantity: 0,
        status: 'RESERVED',
      },
    ],
    reservations: [
      {
        id: 'reservation-1',
        outbound_line_id: 'line-1',
        location_id: 'location-1',
        reserved_quantity: 5,
        reserved_weight: 1.25,
        status: 'ACTIVE',
        released_at: null,
      },
    ],
  })),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  listOutboundDocuments: (...args) => listOutboundDocuments(...args),
  getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
}));

import { OutboundListPage } from '../../src/features/operations/outbound/OutboundListPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <OutboundListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listOutboundDocuments.mockClear();
  getOutboundDocumentDetail.mockClear();
});

describe('Sprint 14J outbound picking read model UI', () => {
  it('renders safety note and loads outbound documents', async () => {
    renderPage();

    expect(screen.getByText('Read-only outbound list/detail. No post outbound. No stock movement OUT. No stock balance update.')).toBeInTheDocument();

    await waitFor(() => {
      expect(listOutboundDocuments).toHaveBeenCalled();
    });
    expect(await screen.findByText('OB-14J-001')).toBeInTheDocument();
  });

  it('refresh/list calls listOutboundDocuments', async () => {
    renderPage();

    await waitFor(() => {
      expect(listOutboundDocuments).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(listOutboundDocuments).toHaveBeenCalledTimes(2);
    });
  });

  it('selecting a document calls getOutboundDocumentDetail and renders detail data', async () => {
    renderPage();

    await waitFor(() => {
      expect(listOutboundDocuments).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole('button', { name: 'View Detail' }));

    await waitFor(() => {
      expect(getOutboundDocumentDetail).toHaveBeenCalledWith('document-1');
    });

    expect(await screen.findByText('product-1')).toBeInTheDocument();
    expect(screen.getByText('lot-1')).toBeInTheDocument();
    expect(screen.getByText('reservation-1')).toBeInTheDocument();
    expect(screen.getByText('location-1')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('does not render forbidden outbound action buttons', async () => {
    renderPage();

    await screen.findByText('OB-14J-001');

    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stock Movement OUT/i })).not.toBeInTheDocument();
  });

  it('source avoids posting and destructive stock mutation code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/outbound/OutboundListPage.jsx');
    const servicePath = path.resolve(process.cwd(), 'src/services/outboundPickingService.js');
    const source = `${fs.readFileSync(pagePath, 'utf8')}\n${fs.readFileSync(servicePath, 'utf8')}`;

    expect(source).not.toContain('tgd_rpc_post_outbound_document');
    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/delete\s+from/i);
    expect(source).not.toMatch(/\btruncate\b/i);
  });
});
