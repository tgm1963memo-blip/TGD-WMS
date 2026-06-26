import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

const {
  postReceivingDocument,
  getReceivingDocumentById,
} = vi.hoisted(() => ({
  postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
  getReceivingDocumentById: vi.fn(async () => ({
    data: {
      id: '00000000-0000-4000-8000-000000000123',
      document_no: 'RCV-DETAIL-001',
      status: 'DRAFT',
      tgd_receiving_lines: [{ id: 'line-1', product_id: 'prod-1', quantity: 5 }],
    },
    error: null,
  })),
}));

vi.mock('../../src/services/receivingService.js', () => ({
  postReceivingDocument: (...args) => postReceivingDocument(...args),
  getReceivingDocumentById: (...args) => getReceivingDocumentById(...args),
  getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'warehouse_admin', ready: true }),
}));

function renderDetailPage(documentId = '00000000-0000-4000-8000-000000000123') {
  return render(
    <MemoryRouter initialEntries={[`/operations/receiving/${documentId}`]}>
      <Routes>
        <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Sprint 13J-AG receiving UI controlled detail post flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postReceivingDocument.mockResolvedValue({ data: { status: 'CONFIRMED' }, error: null });
    getReceivingDocumentById.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000123',
        document_no: 'RCV-DETAIL-001',
        status: 'DRAFT',
        tgd_receiving_lines: [{ id: 'line-1', product_id: 'prod-1', quantity: 5 }],
      },
      error: null,
    });
  });

  it('shows controlled confirm/post panel on detail page', async () => {
    renderDetailPage();
    expect(await screen.findByText('Controlled Confirm/Post')).toBeInTheDocument();
    expect(screen.getByText('No stock movement until Confirm/Post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm/Post Receiving' })).toBeInTheDocument();
  });

  it('posts through service wrapper and shows completion message', async () => {
    renderDetailPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm/Post Receiving' }));

    await waitFor(() => {
      expect(postReceivingDocument).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000123');
    });
    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
  });

  it('shows post error returned by the receiving RPC wrapper', async () => {
    postReceivingDocument.mockResolvedValueOnce({
      data: null,
      error: new Error('Document already confirmed'),
    });

    renderDetailPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm/Post Receiving' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Document already confirmed');
  });

  it('source uses the post service wrapper and avoids direct writes or stock table references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingDetailPage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('postReceivingDocument');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('ReceivingListPage shows source guidance instead of standalone create draft link', () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="en">
          <ReceivingListPage />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('receiving-source-document-guidance')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Internal Receiving Draft' })).not.toBeInTheDocument();
  });

  it('/operations/receiving/:id renders detail for a uuid-like id', async () => {
    renderDetailPage();
    await waitFor(() => {
      expect(getReceivingDocumentById).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000123');
    });
    expect(await screen.findByRole('heading', { name: 'Receiving Detail' })).toBeInTheDocument();
  });
});
