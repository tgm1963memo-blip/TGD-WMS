import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getMovementDraftSelectionState } from '../../src/utils/billingInvoiceDraftUtils.js';

const {
  listBillingInvoiceDraftsMock,
  getBillingInvoiceDraftByIdMock,
  createBillingInvoiceDraftFromMovementsMock,
  approveBillingInvoiceDraftMock,
  cancelBillingInvoiceDraftMock,
  getBillingMovementWeightRowsMock,
  getCustomersMock,
  getProductsMock,
} = vi.hoisted(() => ({
  listBillingInvoiceDraftsMock: vi.fn(),
  getBillingInvoiceDraftByIdMock: vi.fn(),
  createBillingInvoiceDraftFromMovementsMock: vi.fn(),
  approveBillingInvoiceDraftMock: vi.fn(),
  cancelBillingInvoiceDraftMock: vi.fn(),
  getBillingMovementWeightRowsMock: vi.fn(),
  getCustomersMock: vi.fn(),
  getProductsMock: vi.fn(),
}));

vi.mock('../../src/services/billingInvoiceDraftService.js', () => ({
  listBillingInvoiceDrafts: listBillingInvoiceDraftsMock,
  getBillingInvoiceDraftById: getBillingInvoiceDraftByIdMock,
  createBillingInvoiceDraftFromMovements: createBillingInvoiceDraftFromMovementsMock,
  approveBillingInvoiceDraft: approveBillingInvoiceDraftMock,
  cancelBillingInvoiceDraft: cancelBillingInvoiceDraftMock,
}));

vi.mock('../../src/services/billingMovementWeightService.js', () => ({
  getBillingMovementWeightRows: getBillingMovementWeightRowsMock,
  shapeBillingMovementWeightRow: (row) => row,
  BILLING_MOVEMENT_WEIGHT_VIEW_NAME: 'tgd_billing_movement_weight_v',
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: getCustomersMock,
  getProducts: getProductsMock,
}));

vi.mock('../../src/i18n/languageProvider.jsx', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

const { InvoiceDraftListPage } = await import('../../src/features/billing/InvoiceDraftListPage.jsx');
const { InvoiceDraftDetailPage } = await import('../../src/features/billing/InvoiceDraftDetailPage.jsx');
const { BillingMovementWeightReportPage } = await import('../../src/features/reports/BillingMovementWeightReportPage.jsx');

const validMovement = {
  movement_id: 'mv-1',
  movement_type: 'RECEIVE_CONFIRM',
  canonical_movement_type: 'RECEIVE',
  movement_date: '2026-06-01T10:00:00.000Z',
  customer_id: 'cust-1',
  customer_name: 'Alpha',
  product_code: 'FSHR-001',
  qty: 10,
  chargeable_weight: 100,
  is_billable: true,
  billing_status: 'READY_FOR_PREVIEW',
};

const blockedMovement = {
  movement_id: 'mv-2',
  movement_type: 'RECEIVE',
  customer_id: 'cust-1',
  customer_name: 'Alpha',
  qty: 5,
  chargeable_weight: 0,
  is_billable: true,
  billing_status: 'NEEDS_WEIGHT_REVIEW',
};

function readProjectFile(relativePath) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Gate 3B-2 billing invoice draft UI', () => {
  beforeEach(() => {
    listBillingInvoiceDraftsMock.mockReset();
    getBillingInvoiceDraftByIdMock.mockReset();
    createBillingInvoiceDraftFromMovementsMock.mockReset();
    approveBillingInvoiceDraftMock.mockReset();
    cancelBillingInvoiceDraftMock.mockReset();
    getBillingMovementWeightRowsMock.mockReset();
    getCustomersMock.mockReset();
    getProductsMock.mockReset();

    listBillingInvoiceDraftsMock.mockResolvedValue({
      data: [{
        id: 'draft-1',
        draft_no: 'BID-20260608-0001',
        customer_name: 'Alpha',
        status: 'DRAFT',
        total_qty: 10,
        total_chargeable_weight: 100,
        created_at: '2026-06-08T10:00:00.000Z',
      }],
      error: null,
    });

    getBillingInvoiceDraftByIdMock.mockResolvedValue({
      data: {
        draft: {
          id: 'draft-1',
          draft_no: 'BID-20260608-0001',
          customer_name: 'Alpha',
          status: 'DRAFT',
          total_qty: 10,
          total_chargeable_weight: 100,
          currency: 'THB',
        },
        lines: [{
          id: 'line-1',
          source_movement_id: 'mv-1',
          product_code: 'FSHR-001',
          qty: 10,
          chargeable_weight: 100,
          billing_status: 'READY_FOR_PREVIEW',
        }],
      },
      error: null,
    });

    getCustomersMock.mockResolvedValue({ data: [{ id: 'cust-1', name: 'Alpha' }], error: null });
    getProductsMock.mockResolvedValue({ data: [], error: null });
    getBillingMovementWeightRowsMock.mockResolvedValue({
      data: [validMovement, blockedMovement],
      error: null,
      source: 'billing_database_view',
    });
  });

  it('creates invoice draft UI files and routes', () => {
    [
      'src/features/billing/InvoiceDraftListPage.jsx',
      'src/features/billing/InvoiceDraftDetailPage.jsx',
      'src/components/billing/InvoiceDraftListTable.jsx',
      'src/components/billing/InvoiceDraftLinesTable.jsx',
    ].forEach((filePath) => {
      expect(existsSync(path.join(process.cwd(), filePath))).toBe(true);
    });

    const routesSource = readProjectFile('src/app/routes.jsx');
    const navigationSource = readProjectFile('src/app/navigation.js');
    expect(routesSource).toContain('/billing/invoice-drafts');
    expect(navigationSource).toContain('billing-invoice-drafts-menu-item');
  });

  it('renders invoice draft list page', async () => {
    render(<MemoryRouter><InvoiceDraftListPage /></MemoryRouter>);
    expect(await screen.findByTestId('billing-invoice-drafts-page')).toBeInTheDocument();
    expect(await screen.findByTestId('billing-invoice-drafts-table')).toBeInTheDocument();
    expect(screen.getByText('BID-20260608-0001')).toBeInTheDocument();
  });

  it('renders invoice draft detail page with approve and cancel actions', async () => {
    render(
      <MemoryRouter initialEntries={['/billing/invoice-drafts/draft-1']}>
        <Routes>
          <Route path="/billing/invoice-drafts/:draftId" element={<InvoiceDraftDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('billing-invoice-draft-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-draft-lines-table')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-draft-approve-button')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-draft-cancel-button')).toBeInTheDocument();
    expect(screen.queryByTestId('export-bplus-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mark-billed-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bplus-invoice-no-input')).not.toBeInTheDocument();
  });

  it('approves after confirmation, refreshes detail, and becomes read-only', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    approveBillingInvoiceDraftMock.mockResolvedValue({
      data: { id: 'draft-1', status: 'APPROVED' },
      error: null,
    });
    getBillingInvoiceDraftByIdMock
      .mockResolvedValueOnce({
        data: {
          draft: {
            id: 'draft-1',
            draft_no: 'BID-20260608-0001',
            customer_name: 'Alpha',
            status: 'DRAFT',
            total_qty: 10,
            total_chargeable_weight: 100,
            currency: 'THB',
          },
          lines: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          draft: {
            id: 'draft-1',
            draft_no: 'BID-20260608-0001',
            customer_name: 'Alpha',
            status: 'APPROVED',
            total_qty: 10,
            total_chargeable_weight: 100,
            currency: 'THB',
          },
          lines: [],
        },
        error: null,
      });

    render(
      <MemoryRouter initialEntries={['/billing/invoice-drafts/draft-1']}>
        <Routes>
          <Route path="/billing/invoice-drafts/:draftId" element={<InvoiceDraftDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('invoice-draft-approve-button'));

    await waitFor(() => {
      expect(approveBillingInvoiceDraftMock).toHaveBeenCalledWith({ draftId: 'draft-1' });
    });
    expect(confirmMock).toHaveBeenCalledWith('Approve invoice draft BID-20260608-0001?');
    expect(await screen.findByTestId('invoice-draft-approve-success-alert')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-draft-status-badge')).toHaveTextContent('APPROVED');
    expect(screen.queryByTestId('invoice-draft-approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invoice-draft-cancel-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-bplus-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mark-billed-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bplus-invoice-no-input')).not.toBeInTheDocument();

    confirmMock.mockRestore();
  });

  it('shows approval error and keeps draft actions available', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    approveBillingInvoiceDraftMock.mockResolvedValue({
      data: null,
      error: new Error('Approval failed'),
    });

    render(
      <MemoryRouter initialEntries={['/billing/invoice-drafts/draft-1']}>
        <Routes>
          <Route path="/billing/invoice-drafts/:draftId" element={<InvoiceDraftDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('invoice-draft-approve-button'));

    expect(await screen.findByTestId('invoice-draft-approve-error-alert')).toHaveTextContent('Approval failed');
    expect(screen.getByTestId('invoice-draft-approve-button')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-draft-cancel-button')).toBeInTheDocument();

    confirmMock.mockRestore();
  });

  it('keeps create draft button disabled when no selection', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/billing-movement-weight']}>
        <Routes>
          <Route path="/reports/billing-movement-weight" element={<BillingMovementWeightReportPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('billing-movement-weight-report-page')).toBeInTheDocument();
    expect(screen.getByTestId('create-invoice-draft-button')).toBeDisabled();
  });

  it('enables create draft after selecting valid rows and calls service', async () => {
    createBillingInvoiceDraftFromMovementsMock.mockResolvedValue({
      data: {
        draft: { id: 'draft-2', draft_no: 'BID-20260608-0002' },
        lines: [],
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/reports/billing-movement-weight']}>
        <Routes>
          <Route path="/reports/billing-movement-weight" element={<BillingMovementWeightReportPage />} />
          <Route path="/billing/invoice-drafts/:draftId" element={<div data-testid="draft-detail-redirect" />} />
        </Routes>
      </MemoryRouter>,
    );

    const checkbox = await screen.findAllByTestId('billing-movement-row-checkbox');
    fireEvent.click(checkbox[0]);

    const createButton = screen.getByTestId('create-invoice-draft-button');
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBillingInvoiceDraftFromMovementsMock).toHaveBeenCalledWith({
        movementIds: ['mv-1'],
        note: 'E2E_TEST',
      });
    });
  });

  it('shows validation error for mixed customer selection', async () => {
    getBillingMovementWeightRowsMock.mockResolvedValue({
      data: [
        validMovement,
        { ...validMovement, movement_id: 'mv-3', customer_id: 'cust-2', customer_name: 'Beta' },
      ],
      error: null,
      source: 'billing_database_view',
    });

    render(
      <MemoryRouter initialEntries={['/reports/billing-movement-weight']}>
        <Routes>
          <Route path="/reports/billing-movement-weight" element={<BillingMovementWeightReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const checkboxes = await screen.findAllByTestId('billing-movement-row-checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByTestId('create-invoice-draft-button'));

    expect(await screen.findByTestId('invoice-draft-validation-alert')).toHaveTextContent(/same customer/i);
    expect(createBillingInvoiceDraftFromMovementsMock).not.toHaveBeenCalled();
  });

  it('marks NEEDS_WEIGHT_REVIEW rows as not selectable', () => {
    expect(getMovementDraftSelectionState(blockedMovement).selectable).toBe(false);
    expect(getMovementDraftSelectionState(validMovement).selectable).toBe(true);
  });

  it('does not expose forbidden Gate 3B controls in report page source', () => {
    const pageSource = readProjectFile('src/features/reports/BillingMovementWeightReportPage.jsx');
    expect(pageSource).toContain('create-invoice-draft-button');
    expect(pageSource).not.toContain('approve-invoice-draft-button');
    expect(pageSource).not.toContain('export-bplus-button');
    expect(pageSource).not.toContain('mark-billed-button');
    expect(pageSource).not.toContain('bplus-invoice-no-input');
  });

  it('cancel draft flow calls service from detail page source', () => {
    const detailSource = readProjectFile('src/features/billing/InvoiceDraftDetailPage.jsx');
    expect(detailSource).toContain('cancelBillingInvoiceDraft');
    expect(detailSource).toContain('approveBillingInvoiceDraft');
    expect(detailSource).toContain('invoice-draft-approve-button');
    expect(detailSource).toContain('invoice-draft-approve-success-alert');
    expect(detailSource).toContain('invoice-draft-approve-error-alert');
    expect(detailSource).not.toContain('export-bplus-button');
    expect(detailSource).not.toContain('mark-billed-button');
    expect(detailSource).not.toContain('bplus-invoice-no-input');
  });
});
