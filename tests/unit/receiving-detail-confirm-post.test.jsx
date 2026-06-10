import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postReceivingDocument, getReceivingDocumentById, getReceivingStockMovements } = vi.hoisted(() => ({
  postReceivingDocument: vi.fn(async () => ({
    data: { status: 'CONFIRMED' },
    error: null,
  })),
  getReceivingDocumentById: vi.fn(async () => ({
    data: {
      id: '588b8815-3c49-4b12-8d8e-a765f7e55f24',
      document_no: 'AH-UI-RECEIVING-DRAFT-001',
      status: 'DRAFT',
      customer_id: 'cust-1',
      tgd_receiving_lines: [
        { id: 'line-1', product_id: 'p1', lot_no: 'L1', quantity: 10 },
      ],
    },
    error: null,
  })),
  getReceivingStockMovements: vi.fn(async () => ({
    data: [],
    error: null,
  })),
}));

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: 'draft-1', error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
  getReceivingWarehouses: vi.fn(async () => ({ data: [], error: null })),
  postReceivingDocument: (...args) => postReceivingDocument(...args),
  getReceivingDocumentById: (...args) => getReceivingDocumentById(...args),
  getReceivingStockMovements: (...args) => getReceivingStockMovements(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '588b8815-3c49-4b12-8d8e-a765f7e55f24' }),
  };
});

import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';

function renderDetail() {
  return render(
    <MemoryRouter>
      <ReceivingDetailPage />
    </MemoryRouter>,
  );
}

describe('Sprint 13J-AJ-FIX1 ReceivingDetailPage Confirm/Post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReceivingDocumentById.mockResolvedValue({
      data: {
        id: '588b8815-3c49-4b12-8d8e-a765f7e55f24',
        document_no: 'AH-UI-RECEIVING-DRAFT-001',
        status: 'DRAFT',
        customer_id: 'cust-1',
        tgd_receiving_lines: [
          { id: 'line-1', product_id: 'p1', lot_no: 'L1', quantity: 10 },
        ],
      },
      error: null,
    });
    postReceivingDocument.mockResolvedValue({
      data: { status: 'CONFIRMED' },
      error: null,
    });
    getReceivingStockMovements.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('Detail page DRAFT shows Confirm/Post panel and no movement message', async () => {
    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    expect(button).toBeEnabled();
    expect(screen.getByText(/This document is DRAFT/)).toBeInTheDocument();
    expect(screen.getByText('No stock movement until Confirm/Post')).toBeInTheDocument();
    expect(getReceivingStockMovements).not.toHaveBeenCalled();
  });

  it('Detail page CONFIRMED hides Confirm/Post button, shows completed state, and loads movements', async () => {
    getReceivingDocumentById.mockResolvedValueOnce({
      data: {
        id: '588b8815-3c49-4b12-8d8e-a765f7e55f24',
        document_no: 'AH-UI-RECEIVING-DRAFT-001',
        status: 'CONFIRMED',
        customer_id: 'cust-1',
        tgd_receiving_lines: [],
      },
      error: null,
    });
    getReceivingStockMovements.mockResolvedValueOnce({
      data: [
        {
          id: 'a028c2a8-59fd-4e1f-ab66-5399c0b2774b',
          movement_type: 'RECEIPT',
          quantity: 3,
          weight: 12,
          to_location_id: 'loc-1',
          source_line_id: 'line-1',
          created_at: '2026-06-02T08:00:00Z',
        },
      ],
      error: null,
    });

    renderDetail();

    await screen.findByText('Controlled Confirm/Post');
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(screen.getByText('Confirm/Post completed. Stock movement display is read-only.')).toBeInTheDocument();
    expect(screen.getByText('Status: CONFIRMED')).toBeInTheDocument();
    expect(await screen.findByText('a028c2a8-59fd-4e1f-ab66-5399c0b2774b')).toBeInTheDocument();
    expect(getReceivingStockMovements).toHaveBeenCalledWith('588b8815-3c49-4b12-8d8e-a765f7e55f24');
  });

  it('calls postReceivingDocument with document id on click', async () => {
    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(postReceivingDocument).toHaveBeenCalledWith('588b8815-3c49-4b12-8d8e-a765f7e55f24');
    });
  });

  it('disables button while posting', async () => {
    let resolvePost;
    postReceivingDocument.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePost = resolve;
    }));

    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'Posting receiving...' })).toBeDisabled();
    resolvePost({ data: { status: 'CONFIRMED' }, error: null });
    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
  });

  it('Confirm/Post success triggers movement section reload and status update', async () => {
    getReceivingDocumentById
      .mockResolvedValueOnce({
        data: {
          id: '588b8815-3c49-4b12-8d8e-a765f7e55f24',
          document_no: 'AH-UI-RECEIVING-DRAFT-001',
          status: 'DRAFT',
          customer_id: 'cust-1',
          tgd_receiving_lines: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: '588b8815-3c49-4b12-8d8e-a765f7e55f24',
          document_no: 'AH-UI-RECEIVING-DRAFT-001',
          status: 'CONFIRMED',
          customer_id: 'cust-1',
          tgd_receiving_lines: [],
        },
        error: null,
      });
    getReceivingStockMovements.mockResolvedValueOnce({
      data: [
        {
          id: 'a028c2a8-59fd-4e1f-ab66-5399c0b2774b',
          movement_type: 'RECEIPT',
          quantity: 3,
          weight: null,
          to_location_id: 'loc-1',
          source_line_id: 'line-1',
          created_at: '2026-06-02T08:00:00Z',
        },
      ],
      error: null,
    });

    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
    expect(screen.getByText('Status: CONFIRMED')).toBeInTheDocument();
    expect(await screen.findByText('a028c2a8-59fd-4e1f-ab66-5399c0b2774b')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(getReceivingDocumentById).toHaveBeenCalledTimes(2);
    expect(getReceivingStockMovements).toHaveBeenCalledWith('588b8815-3c49-4b12-8d8e-a765f7e55f24');
  });

  it('does not call postReceivingDocument again after success', async () => {
    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    await screen.findByText('Receiving document Confirm/Post completed.');
    // No button to click after success
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(postReceivingDocument).toHaveBeenCalledTimes(1);
  });

  it('Refresh does not call postReceivingDocument', async () => {
    renderDetail();

    await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(getReceivingDocumentById).toHaveBeenCalledTimes(2);
    });
    expect(postReceivingDocument).not.toHaveBeenCalled();
  });

  it('shows RPC error message on post failure', async () => {
    postReceivingDocument.mockResolvedValueOnce({
      data: null,
      error: new Error('Document already confirmed'),
    });

    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Document already confirmed');
    expect(screen.getByRole('button', { name: 'Confirm/Post Receiving' })).toBeEnabled();
  });

  it('ReceivingDetailPage source uses postReceivingDocument wrapper and no direct RPC or DML', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingDetailPage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    // Allowed
    expect(source).toContain('postReceivingDocument');
    // Forbidden
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
  });

  it('getReceivingStockMovements uses SELECT-only receiving document filters', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.resolve(process.cwd(), 'src/services/receivingService.js');
    const source = fs.readFileSync(servicePath, 'utf8');
    const functionSource = source.slice(
      source.indexOf('export async function getReceivingStockMovements'),
      source.indexOf('export async function createReceivingDocument'),
    );

    expect(functionSource).toContain(".from('tgd_stock_movements')");
    expect(functionSource).toContain('.select(');
    expect(functionSource).toContain(".eq('source_module', 'RECEIVING')");
    expect(functionSource).toContain(".eq('source_document_id', documentId)");
    expect(functionSource).not.toMatch(/\.insert\s*\(/);
    expect(functionSource).not.toMatch(/\.update\s*\(/);
    expect(functionSource).not.toMatch(/\.delete\s*\(/);
    expect(functionSource).not.toMatch(/\.upsert\s*\(/);
    expect(functionSource).not.toMatch(/\.rpc\s*\(/);
    expect(functionSource).not.toContain('tgd_stock_balances');
  });
});
