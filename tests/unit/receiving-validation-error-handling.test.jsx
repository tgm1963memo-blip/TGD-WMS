import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivingCreatePage, normalizeReceivingError } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import * as receivingService from '../../src/services/receivingService.js';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingCustomers: vi.fn(async () => ({ data: [{ id: 'cust-1', label: 'C1' }], error: null })),
  getReceivingProducts: vi.fn(async () => ({ data: [{ id: 'prod-1', label: 'P1' }], error: null })),
  getReceivingLots: vi.fn(async () => ({ data: [{ id: 'lot-1', label: 'L1', product_id: 'prod-1' }], error: null })),
  getReceivingLocations: vi.fn(async () => ({ data: [{ id: 'loc-1', label: 'Loc 1' }], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: 'draft-1', error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
  postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
}));

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

  describe('ReceivingCreatePage Validations', () => {
    const renderComponent = () => render(
      <MemoryRouter>
        <ReceivingCreatePage />
      </MemoryRouter>
    );

    it('Save Draft is disabled without customer and document no', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');
      const btn = screen.getByRole('button', { name: 'Save Draft' });
      expect(btn).toBeDisabled();
    });

    it('Save Draft trims document no before service call', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');

      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: '   DOC-123   ' } });

      const btn = screen.getByRole('button', { name: 'Save Draft' });
      expect(btn).toBeEnabled();
      fireEvent.click(btn);

      await waitFor(() => {
        expect(receivingService.createReceivingDocument).toHaveBeenCalledWith({
          customer_id: 'cust-1',
          document_no: 'DOC-123',
        });
      });
    });

    it('Add Line disabled without draft id', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');
      const btn = screen.getByRole('button', { name: 'Add Line' });
      expect(btn).toBeDisabled();
    });

    it('Add Line rejects quantity <= 0 or non-numeric', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');
      
      // Create draft first to enable Add Line
      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      
      await screen.findByText('Draft Created');

      // Fill in all required fields except valid quantity
      fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'prod-1' } });
      fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'loc-1' } });
      
      // Test quantity 0
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
      const addBtn = screen.getByRole('button', { name: 'Add Line' });
      fireEvent.click(addBtn);
      
      expect(await screen.findByRole('alert')).toHaveTextContent('Quantity must be a number greater than 0');
      
      // Test quantity non-numeric (the input type is number so it's a bit tricky but handled by JS if forced)
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: 'abc' } });
      fireEvent.click(addBtn);
      expect(await screen.findByRole('alert')).toHaveTextContent('Quantity must be a number greater than 0');
    });

    it('Add Line rejects lot/product mismatch', async () => {
      receivingService.getReceivingLots.mockResolvedValueOnce({ 
        data: [{ id: 'lot-1', label: 'L1', product_id: 'different-prod' }], 
        error: null 
      });
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');
      
      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      
      await screen.findByText('Draft Created');

      fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'prod-1' } });
      fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'loc-1' } });
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
      
      fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
      
      expect(await screen.findByRole('alert')).toHaveTextContent('Selected lot does not match the selected product');
    });

    it('Manual UUID fallback rejects invalid uuid before service call', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');

      fireEvent.click(screen.getByLabelText('Use manual UUID entry'));

      // Save Draft invalid UUID
      fireEvent.change(screen.getByLabelText('Customer ID'), { target: { value: 'invalid-uuid' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid customer UUID format');
      expect(receivingService.createReceivingDocument).not.toHaveBeenCalled();

      // Fix customer to valid UUID
      fireEvent.change(screen.getByLabelText('Customer ID'), { target: { value: '12345678-1234-1234-1234-1234567890ab' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      await screen.findByText('Draft Created');

      // Add Line invalid product UUID
      fireEvent.change(screen.getByLabelText('Product ID'), { target: { value: 'invalid-prod' } });
      fireEvent.change(screen.getByLabelText('Lot ID'), { target: { value: '12345678-1234-1234-1234-1234567890ab' } });
      fireEvent.change(screen.getByLabelText('Location ID'), { target: { value: '12345678-1234-1234-1234-1234567890ab' } });
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });

      fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid product UUID format');
      expect(receivingService.addReceivingLine).not.toHaveBeenCalled();
    });

    it('Confirm/Post disabled after success and not called without draft id', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');

      // Not available initially
      expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();

      // Create draft
      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      await screen.findByText('Draft Created');

      // Add a line so Confirm/Post is allowed
      fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'prod-1' } });
      fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'loc-1' } });
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));

      await screen.findByText('Receiving line added.');

      const postBtn = screen.getByRole('button', { name: 'Confirm/Post Receiving' });
      fireEvent.click(postBtn);

      await screen.findByText('Receiving document Confirm/Post completed.');
      const finalBtn = screen.getByRole('button', { name: 'Confirm/Post Receiving' });
      expect(finalBtn).toBeDisabled();
    });
    
    it('Confirm/Post rejects if no lines added yet', async () => {
      renderComponent();
      await screen.findByText('Use read-only master pickers for receiving IDs.');

      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'cust-1' } });
      fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'DOC-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      await screen.findByText('Draft Created');

      const postBtn = screen.getByRole('button', { name: 'Confirm/Post Receiving' });
      fireEvent.click(postBtn);
      
      expect(await screen.findByRole('alert')).toHaveTextContent('Must have at least one line before Confirm/Post.');
      expect(receivingService.postReceivingDocument).not.toHaveBeenCalled();
    });
    
    it('Safety constraints: UI still has no direct DML or stock table references', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
      const source = fs.readFileSync(pagePath, 'utf8');

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
});
