import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/routes.jsx';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

const { createReceivingDocument, addReceivingLine, getReceivingDocumentById } = vi.hoisted(() => ({
  createReceivingDocument: vi.fn(async () => ({
    data: 'draft-123',
    error: null,
  })),
  addReceivingLine: vi.fn(async () => ({
    data: 'line-456',
    error: null,
  })),
  getReceivingDocumentById: vi.fn(async () => ({
    data: {
      id: '00000000-0000-4000-8000-000000000123',
      receiving_no: 'RCV-DETAIL-001',
      status: 'DRAFT',
      tgd_receiving_lines: [],
    },
    error: null,
  })),
}));

vi.mock('../../src/services/receivingService.js', () => ({
  createReceivingDocument: (...args) => createReceivingDocument(...args),
  addReceivingLine: (...args) => addReceivingLine(...args),
  getReceivingDocumentById: (...args) => getReceivingDocumentById(...args),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReceivingCreatePage />
    </MemoryRouter>,
  );
}

describe('Sprint 13J-AG receiving UI controlled draft unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows controlled draft mode and no longer uses the locked page title', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: 'Receiving Create Locked' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Controlled receiving draft mode' })).toBeInTheDocument();
    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Document No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getAllByText('Confirm/Post is still locked').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Confirm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
  });

  it('Save Draft calls createReceivingDocument with customer_id and document_no', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Customer ID'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AG-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(createReceivingDocument).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        document_no: 'RCV-13J-AG-001',
      });
    });

    expect(await screen.findByText('draft-123')).toBeInTheDocument();
    expect(screen.getByText('RCV-13J-AG-001')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Line section' })).toBeInTheDocument();
  });

  it('Add Line requires document id and then calls addReceivingLine with explicit location', async () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Add Line' })).toBeDisabled();
    expect(screen.getByText('Add Line requires document id.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Customer ID'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AG-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');

    fireEvent.change(screen.getByLabelText('Product ID'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot ID'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location ID'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));

    await waitFor(() => {
      expect(addReceivingLine).toHaveBeenCalledWith({
        document_id: 'draft-123',
        product_id: 'product-1',
        lot_id: 'lot-1',
        location_id: 'location-1',
        quantity: 5,
        weight: 2.5,
      });
    });

    expect(await screen.findByText(/line-456/)).toBeInTheDocument();
  });

  it('source does not import postReceivingDocument or use direct Supabase writes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).not.toContain('postReceivingDocument');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('ReceivingListPage links to the controlled receiving draft page', () => {
    render(
      <MemoryRouter>
        <ReceivingListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Receiving creation is controlled draft mode only. Confirm/Post remains locked.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Receiving Draft' })).toHaveAttribute(
      'href',
      '/operations/receiving/create',
    );
  });

  it('ReceivingListPage does not import postReceivingDocument or use direct write patterns', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingListPage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).not.toContain('postReceivingDocument');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('defines the static receiving create route before the dynamic id route', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const routesPath = path.resolve(process.cwd(), 'src/app/routes.jsx');
    const source = fs.readFileSync(routesPath, 'utf8');

    expect(source).toContain('path="/operations/receiving/create"');
    expect(source.indexOf('path="/operations/receiving/create"')).toBeLessThan(
      source.indexOf('path="/operations/receiving/:id"'),
    );
  });

  it('/operations/receiving/create renders controlled draft UI instead of detail', () => {
    render(
      <MemoryRouter initialEntries={['/operations/receiving/create']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Controlled receiving draft mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Line section' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Receiving Detail' })).not.toBeInTheDocument();
    expect(getReceivingDocumentById).not.toHaveBeenCalledWith('create');
    expect(screen.getAllByText('Confirm/Post is still locked').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Confirm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
  });

  it('/operations/receiving/:id still renders detail for a uuid-like id', async () => {
    const documentId = '00000000-0000-4000-8000-000000000123';

    render(
      <MemoryRouter initialEntries={[`/operations/receiving/${documentId}`]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getReceivingDocumentById).toHaveBeenCalledWith(documentId);
    });
    expect(await screen.findByRole('heading', { name: 'Receiving Detail' })).toBeInTheDocument();
  });
});
