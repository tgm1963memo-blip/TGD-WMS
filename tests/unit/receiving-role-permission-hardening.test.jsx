import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import * as receivingService from '../../src/services/receivingService.js';

const mockUserRole = vi.hoisted(() => ({ value: 'warehouse_admin' }));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: mockUserRole.value, ready: true }),
}));

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingCustomers: vi.fn(async () => ({ data: [], error: null })),
  getReceivingProducts: vi.fn(async () => ({ data: [], error: null })),
  getReceivingLots: vi.fn(async () => ({ data: [], error: null })),
  getReceivingLocations: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocumentById: vi.fn(async () => ({
    data: {
      id: 'draft-1',
      document_no: 'RCV-001',
      status: 'DRAFT',
      tgd_receiving_lines: [{ id: 'line-1', product_id: 'prod-1', quantity: 5 }],
    },
    error: null,
  })),
  getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
  postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn(async () => ({ data: [], error: null })),
}));

describe('Sprint 13J-AO Receiving Role / Permission Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ReceivingListPage', () => {
    it('shows customer deposit source guidance to authorized role', async () => {
      mockUserRole.value = 'warehouse_admin';
      render(
        <MemoryRouter>
          <LanguageProvider initialLanguage="en">
            <ReceivingListPage />
          </LanguageProvider>
        </MemoryRouter>,
      );
      expect(await screen.findByTestId('receiving-source-document-guidance')).toBeInTheDocument();
    });

    it('still renders list shell for viewer', async () => {
      mockUserRole.value = 'viewer';
      render(
        <MemoryRouter>
          <LanguageProvider initialLanguage="en">
            <ReceivingListPage />
          </LanguageProvider>
        </MemoryRouter>,
      );
      await screen.findByTestId('receiving-source-document-guidance');
      expect(screen.queryByRole('link', { name: 'Create Internal Receiving Draft' })).not.toBeInTheDocument();
    });
  });

  describe('ReceivingDetailPage', () => {
    const renderDetailPage = () => render(
      <MemoryRouter initialEntries={['/operations/receiving/draft-1']}>
        <Routes>
          <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    it('hides Confirm/Post button from viewer', async () => {
      mockUserRole.value = 'viewer';
      renderDetailPage();
      await screen.findByText('Controlled Confirm/Post');
      expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
      expect(screen.getByText(/Confirm\/Post is restricted/i)).toBeInTheDocument();
    });

    it('shows Confirm/Post button to admin and handles RPC permission error', async () => {
      mockUserRole.value = 'admin';
      receivingService.postReceivingDocument.mockResolvedValueOnce({
        data: null,
        error: new Error('new row violates row-level security policy'),
      });

      renderDetailPage();

      const postBtn = await screen.findByRole('button', { name: 'Confirm/Post Receiving' });
      fireEvent.click(postBtn);

      expect(await screen.findByRole('alert')).toHaveTextContent('row-level security policy');
    });
  });
});
