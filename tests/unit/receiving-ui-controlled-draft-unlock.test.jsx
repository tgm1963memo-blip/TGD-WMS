import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/routes.jsx';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

const {
  createReceivingDocument,
  addReceivingLine,
  postReceivingDocument,
  getReceivingDocumentById,
  getReceivingCustomers,
  getReceivingProducts,
  getReceivingLots,
  getReceivingLocations,
  getUser,
  getSession,
} = vi.hoisted(() => ({
  createReceivingDocument: vi.fn(async () => ({
    data: { id: 'draft-1', document_id: 'draft-1' },
    error: null,
  })),
  addReceivingLine: vi.fn(async () => ({
    data: 'line-456',
    error: null,
  })),
  postReceivingDocument: vi.fn(async () => ({
    data: { status: 'CONFIRMED' },
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
  getReceivingCustomers: vi.fn(async () => ({
    data: [{ id: 'customer-1', code: 'CUST-1', name: 'Customer One', label: 'CUST-1 - Customer One' }],
    error: null,
  })),
  getReceivingProducts: vi.fn(async () => ({
    data: [{ id: 'product-1', code: 'PROD-1', name: 'Product One', label: 'PROD-1 - Product One' }],
    error: null,
  })),
  getReceivingLots: vi.fn(async () => ({
    data: [{ id: 'lot-1', lot_no: 'LOT-1', code: 'LOT-1', product_id: 'product-1', label: 'LOT-1' }],
    error: null,
  })),
  getReceivingLocations: vi.fn(async () => ({
    data: [{ id: 'location-1', code: 'LOC-1', name: 'Location One', label: 'LOC-1 - Location One' }],
    error: null,
  })),
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getUser: (...args) => getUser(...args),
      getSession: (...args) => getSession(...args),
    },
  },
}));

vi.mock('../../src/services/receivingService.js', () => ({
  createReceivingDocument: (...args) => createReceivingDocument(...args),
  addReceivingLine: (...args) => addReceivingLine(...args),
  postReceivingDocument: (...args) => postReceivingDocument(...args),
  getReceivingDocumentById: (...args) => getReceivingDocumentById(...args),
  getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
  getReceivingCustomers: (...args) => getReceivingCustomers(...args),
  getReceivingProducts: (...args) => getReceivingProducts(...args),
  getReceivingLots: (...args) => getReceivingLots(...args),
  getReceivingLocations: (...args) => getReceivingLocations(...args),
  getReceivingWarehouses: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/features/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({ session: { user: { id: 'test-user' } }, loading: false, isAuthenticated: true })),
  AuthProvider: ({ children }) => children,
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
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    createReceivingDocument.mockResolvedValue({
      data: { id: 'draft-123', document_id: 'draft-123' },
      error: null,
    });
    addReceivingLine.mockResolvedValue({
      data: 'line-456',
      error: null,
    });
    postReceivingDocument.mockResolvedValue({
      data: { status: 'CONFIRMED' },
      error: null,
    });
    getReceivingDocumentById.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000123',
        receiving_no: 'RCV-DETAIL-001',
        status: 'DRAFT',
        tgd_receiving_lines: [],
      },
      error: null,
    });
    getReceivingCustomers.mockResolvedValue({
      data: [{ id: 'customer-1', code: 'CUST-1', name: 'Customer One', label: 'CUST-1 - Customer One' }],
      error: null,
    });
    getReceivingProducts.mockResolvedValue({
      data: [{ id: 'product-1', code: 'PROD-1', name: 'Product One', label: 'PROD-1 - Product One' }],
      error: null,
    });
    getReceivingLots.mockResolvedValue({
      data: [{ id: 'lot-1', lot_no: 'LOT-1', code: 'LOT-1', product_id: 'product-1', label: 'LOT-1' }],
      error: null,
    });
    getReceivingLocations.mockResolvedValue({
      data: [{ id: 'location-1', code: 'LOC-1', name: 'Location One', label: 'LOC-1 - Location One' }],
      error: null,
    });
  });

  it('shows controlled draft mode and no longer uses the locked page title', async () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: 'Receiving Create Locked' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Controlled receiving draft mode' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Document No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByText('Controlled Confirm/Post')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
  });

  it('customer picker loads and Save Draft uses selected customer id', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: 'CUST-1 - Customer One' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'customer-1' } });
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
    expect(screen.getByText('Selected customer id: customer-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Line section' })).toBeInTheDocument();
  });

  it('does not wait for auth diagnostics before creating the draft', async () => {
    getUser.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByRole('option', { name: 'CUST-1 - Customer One' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-AUTH-DIAG-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(createReceivingDocument).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        document_no: 'RCV-AUTH-DIAG-001',
      });
    });
  });

  it('Save Draft disabled without customer/document no', async () => {
    renderPage();

    const saveButton = screen.getByRole('button', { name: 'Save Draft' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AG-002' } });
    expect(saveButton).toBeEnabled();
  });

  it('product/lot/location pickers load and Add Line uses selected ids', async () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Add Line' })).toBeDisabled();
    expect(screen.getByText('Add Line requires: Missing document id')).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AG-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');

    expect(screen.getByRole('option', { name: 'PROD-1 - Product One' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'LOT-1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'LOC-1 - Location One' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-1' } });
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
    expect(screen.getByText('Selected product id: product-1')).toBeInTheDocument();
    expect(screen.getByText('Selected lot id: lot-1')).toBeInTheDocument();
    expect(screen.getByText('Selected location id: location-1')).toBeInTheDocument();
  });

  it('Add Line disabled without product/lot/location/quantity', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AL-003' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');
    const addButton = screen.getByRole('button', { name: 'Add Line' });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-1' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
    expect(addButton).toBeEnabled();
  });

  it('shows Confirm/Post after draft creation and posts through the service wrapper', async () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AI-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
    await screen.findByText(/line-/);

    const postButton = screen.getByRole('button', { name: 'Confirm/Post Receiving' });
    expect(postButton).toBeEnabled();

    fireEvent.click(postButton);

    await waitFor(() => {
      expect(postReceivingDocument).toHaveBeenCalledWith('draft-123');
    });
    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm/Post Receiving' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm/Post Receiving' }));
    expect(postReceivingDocument).toHaveBeenCalledTimes(1);
  });

  it('disables Confirm/Post while posting', async () => {
    let resolvePost;
    postReceivingDocument.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePost = resolve;
    }));

    renderPage();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AI-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
    await screen.findByText(/line-/);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm/Post Receiving' }));

    expect(screen.getByRole('button', { name: 'Posting receiving...' })).toBeDisabled();
    resolvePost({ data: { status: 'CONFIRMED' }, error: null });
    expect(await screen.findByText('Receiving document Confirm/Post completed.')).toBeInTheDocument();
  });

  it('shows post error returned by the receiving RPC wrapper', async () => {
    postReceivingDocument.mockResolvedValueOnce({
      data: null,
      error: new Error('Document already confirmed'),
    });

    renderPage();

    fireEvent.change(await screen.findByLabelText('Customer'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Document No'), { target: { value: 'RCV-13J-AI-003' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await screen.findByText('draft-123');
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Lot'), { target: { value: 'lot-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
    await screen.findByText(/line-/);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm/Post Receiving' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Document already confirmed');
    expect(screen.getByRole('button', { name: 'Confirm/Post Receiving' })).toBeEnabled();
  });

  it('source uses the post service wrapper and avoids direct writes or stock table references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pagePath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('postReceivingDocument');
    expect(source).toContain('createReceivingDocument');
    expect(source).toContain('addReceivingLine');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('picker lookup functions are SELECT-only', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.resolve(process.cwd(), 'src/services/receivingService.js');
    const source = fs.readFileSync(servicePath, 'utf8');

    ['getReceivingCustomers', 'getReceivingProducts', 'getReceivingLots', 'getReceivingLocations'].forEach((name) => {
      const functionStart = source.indexOf(`export async function ${name}`);
      const nextFunctionStart = source.indexOf('export async function', functionStart + 1);
      const functionSource = source.slice(functionStart, nextFunctionStart === -1 ? undefined : nextFunctionStart);

      expect(functionSource).toContain('.select(');
      expect(functionSource).not.toMatch(/\.insert\s*\(/);
      expect(functionSource).not.toMatch(/\.update\s*\(/);
      expect(functionSource).not.toMatch(/\.delete\s*\(/);
      expect(functionSource).not.toMatch(/\.upsert\s*\(/);
      expect(functionSource).not.toMatch(/\.rpc\s*\(/);
      expect(functionSource).not.toMatch(/production/i);
    });
  });

  it('ReceivingListPage links to the controlled receiving draft page', () => {
    render(
      <MemoryRouter>
        <ReceivingListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Receiving creation is controlled draft mode only. Confirm/Post is available on draft page via RPC.')).toBeInTheDocument();
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
    expect(screen.getByText('Controlled Confirm/Post')).toBeInTheDocument();
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
