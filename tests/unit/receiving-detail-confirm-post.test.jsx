import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postReceivingDocument, getReceivingDocumentById } = vi.hoisted(() => ({
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
}));

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: 'draft-1', error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
  postReceivingDocument: (...args) => postReceivingDocument(...args),
  getReceivingDocumentById: (...args) => getReceivingDocumentById(...args),
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
  });

  it('shows Confirm/Post Receiving button for an existing DRAFT document', async () => {
    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    expect(button).toBeEnabled();
    expect(screen.getByText(/This document is DRAFT/)).toBeInTheDocument();
  });

  it('does NOT show Confirm/Post button for an existing CONFIRMED document', async () => {
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

    renderDetail();

    await screen.findByText('Controlled Confirm/Post');
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(screen.getByText('Confirm/Post is not available for this document status.')).toBeInTheDocument();
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

  it('shows CONFIRMED after successful post', async () => {
    renderDetail();

    const button = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
    fireEvent.click(button);

    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
    expect(screen.getByText('Status: CONFIRMED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
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
});
