import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';
import * as receivingService from '../../src/services/receivingService.js';
import * as currentUserRole from '../../src/security/currentUserRole.js';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingCustomers: vi.fn(async () => ({ data: [{ id: 'cust-1', label: 'C1' }], error: null })),
  getReceivingProducts: vi.fn(async () => ({ data: [{ id: 'prod-1', label: 'P1' }], error: null })),
  getReceivingLots: vi.fn(async () => ({ data: [{ id: 'lot-1', label: 'L1', product_id: 'prod-1' }], error: null })),
  getReceivingLocations: vi.fn(async () => ({ data: [{ id: 'loc-1', label: 'Loc 1' }], error: null })),
  getReceivingWarehouses: vi.fn(async () => ({ data: [], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: { id: 'draft-1', document_id: 'draft-1' }, error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
  postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocumentById: vi.fn(async () => ({ data: { id: 'draft-1', status: 'DRAFT', tgd_receiving_lines: [] }, error: null })),
  getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/security/currentUserRole.js', () => ({
  getCurrentUserRole: vi.fn(() => 'admin'),
}));

describe('Sprint 13J-AO Receiving Role / Permission Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ReceivingListPage', () => {
    it('shows Create Receiving Draft button to authorized role', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('warehouse_staff');
      render(
        <MemoryRouter>
          <ReceivingListPage />
        </MemoryRouter>
      );
      expect(await screen.findByRole('link', { name: 'Create Receiving Draft' })).toBeInTheDocument();
    });

    it('hides Create Receiving Draft button from viewer', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('viewer');
      render(
        <MemoryRouter>
          <ReceivingListPage />
        </MemoryRouter>
      );
      await screen.findByText('Receiving Documents');
      expect(screen.queryByRole('link', { name: 'Create Receiving Draft' })).not.toBeInTheDocument();
    });
  });

  describe('ReceivingCreatePage', () => {
    const renderCreatePage = () => render(
      <MemoryRouter>
        <ReceivingCreatePage />
      </MemoryRouter>
    );

    it('denies access to viewer entirely', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('viewer');
      renderCreatePage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
      expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
    });

    it('allows access to admin and handles RPC authentication error', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('admin');
      
      receivingService.createReceivingDocument.mockResolvedValueOnce({
        data: null,
        error: new Error('JWT token is missing or invalid'),
      });

      renderCreatePage();
      
      fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Authentication required');
    });
  });

  describe('ReceivingDetailPage', () => {
    const renderDetailPage = () => render(
      <MemoryRouter initialEntries={['/operations/receiving/draft-1']}>
        <Routes>
          <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    it('hides Confirm/Post button from viewer', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('viewer');
      renderDetailPage();
      await screen.findByText('Controlled Confirm/Post');
      expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
      expect(screen.getByText(/Confirm\/Post is restricted/i)).toBeInTheDocument();
    });

    it('shows Confirm/Post button to admin and handles RPC permission error', async () => {
      currentUserRole.getCurrentUserRole.mockReturnValue('admin');
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
