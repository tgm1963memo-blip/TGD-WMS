import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';
import { normalizeReceivingError } from '../../src/services/receivingService.js';
import * as receivingService from '../../src/services/receivingService.js';

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'warehouse_admin', ready: true }),
}));

vi.mock('../../src/services/receivingService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getReceivingDocumentById: vi.fn(async () => ({
      data: {
        id: 'draft-1',
        document_no: 'RCV-001',
        status: 'DRAFT',
        tgd_receiving_lines: [],
      },
      error: null,
    })),
    getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
    postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
  };
});

describe('Sprint 13J-AM receiving validation and error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeReceivingError', () => {
    it('formats duplicate key value errors', () => {
      const msg = normalizeReceivingError(new Error('duplicate key value violates unique constraint'));
      expect(msg).toContain('Duplicate document number');
    });

    it('formats invalid uuid errors', () => {
      const msg = normalizeReceivingError(new Error('invalid input syntax for type uuid'));
      expect(msg).toContain('Invalid UUID format');
    });

    it('formats status is CONFIRMED errors', () => {
      const msg = normalizeReceivingError(new Error('document status is CONFIRMED'));
      expect(msg).toContain('Document is already CONFIRMED');
    });

    it('formats authentication errors', () => {
      const msg = normalizeReceivingError(new Error('JWT token is missing'));
      expect(msg).toContain('Authentication required');
    });

    it('formats missing required field errors', () => {
      const msg = normalizeReceivingError(new Error('null value in column "document_no" violates not-null constraint'));
      expect(msg).toContain('Missing required field');
    });
  });

  describe('ReceivingDetailPage post handling', () => {
    const renderDetailPage = () => render(
      <MemoryRouter initialEntries={['/operations/receiving/draft-1']}>
        <Routes>
          <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    it('shows draft movement guard before post', async () => {
      renderDetailPage();
      expect(await screen.findByText('No stock movement until Confirm/Post')).toBeInTheDocument();
    });

    it('posts through service wrapper and shows success message', async () => {
      receivingService.getReceivingDocumentById.mockResolvedValueOnce({
        data: {
          id: 'draft-1',
          document_no: 'RCV-001',
          status: 'DRAFT',
          tgd_receiving_lines: [{ id: 'line-1', product_id: 'prod-1', quantity: 5 }],
        },
        error: null,
      });

      renderDetailPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm/Post Receiving' }));

      await waitFor(() => {
        expect(receivingService.postReceivingDocument).toHaveBeenCalledWith('draft-1');
      });
      expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
    });

    it('surfaces RPC errors from postReceivingDocument', async () => {
      receivingService.getReceivingDocumentById.mockResolvedValueOnce({
        data: {
          id: 'draft-1',
          document_no: 'RCV-001',
          status: 'DRAFT',
          tgd_receiving_lines: [{ id: 'line-1', product_id: 'prod-1', quantity: 5 }],
        },
        error: null,
      });
      receivingService.postReceivingDocument.mockResolvedValueOnce({
        data: null,
        error: new Error('permission denied for function'),
      });

      renderDetailPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm/Post Receiving' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('permission denied for function');
    });

    it('source uses post service wrapper and avoids direct writes', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingDetailPage.jsx');
      const source = fs.readFileSync(pagePath, 'utf8');

      expect(source).toContain('postReceivingDocument');
      expect(source).not.toContain('tgd_rpc_post_receiving_document');
      expect(source).not.toContain('supabase.from');
      expect(source).not.toMatch(/\.insert\s*\(/);
      expect(source).not.toMatch(/\.update\s*\(/);
      expect(source).not.toMatch(/\.delete\s*\(/);
      expect(source).not.toMatch(/\.upsert\s*\(/);
      expect(source).not.toContain('tgd_stock_movements');
      expect(source).not.toContain('tgd_stock_balances');
    });
  });
});
