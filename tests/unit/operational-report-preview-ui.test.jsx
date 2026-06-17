import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { ReceivingDetailPage } from '../../src/features/operations/receiving/ReceivingDetailPage.jsx';
import { OutboundListPage } from '../../src/features/operations/outbound/OutboundListPage.jsx';
import { MovementLedgerReportPage } from '../../src/features/reports/MovementLedgerReportPage.jsx';

const receivingMocks = vi.hoisted(() => ({
  getReceivingDocumentById: vi.fn(),
  getReceivingStockMovements: vi.fn(),
  postReceivingDocument: vi.fn(),
}));

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocumentById: (...args) => receivingMocks.getReceivingDocumentById(...args),
  getReceivingStockMovements: (...args) => receivingMocks.getReceivingStockMovements(...args),
  postReceivingDocument: (...args) => receivingMocks.postReceivingDocument(...args),
  getReceivingWarehouses: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

const outboundMocks = vi.hoisted(() => ({
  listOutboundDocuments: vi.fn(),
  getOutboundDocumentDetail: vi.fn(),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  listOutboundDocuments: (...args) => outboundMocks.listOutboundDocuments(...args),
  getOutboundDocumentDetail: (...args) => outboundMocks.getOutboundDocumentDetail(...args),
}));

const ledgerMocks = vi.hoisted(() => ({
  getMovementLedgerRows: vi.fn(),
  getMovementLedgerSummary: vi.fn(),
  getMovementTypeBreakdown: vi.fn(),
}));

vi.mock('../../src/services/movementLedgerReportService.js', () => ({
  getMovementLedgerRows: (...args) => ledgerMocks.getMovementLedgerRows(...args),
  getMovementLedgerSummary: (...args) => ledgerMocks.getMovementLedgerSummary(...args),
  getMovementTypeBreakdown: (...args) => ledgerMocks.getMovementTypeBreakdown(...args),
  summarizeMovements: (rows) => ({
    totalMovementRows: rows.length,
    totalInboundQty: 0,
    totalOutboundQty: 0,
    netMovementQty: 0,
    uniqueCustomers: 0,
    uniqueLots: 0,
    uniquePallets: 0,
  }),
  groupByMovementType: () => [],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'rcv-1' }),
  };
});

function renderWithLanguage(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider initialLanguage="en">
        {ui}
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  receivingMocks.getReceivingDocumentById.mockResolvedValue({
    data: {
      id: 'rcv-1',
      document_no: 'RCV-001',
      status: 'DRAFT',
      customer_id: 'CUST-1',
      tgd_receiving_lines: [{ id: 'line-1', product_id: 'PRD-1', quantity: 5 }],
    },
    error: null,
  });
  receivingMocks.getReceivingStockMovements.mockResolvedValue({ data: [], error: null });

  outboundMocks.listOutboundDocuments.mockResolvedValue([{ id: 'out-1', document_no: 'OUT-001', status: 'DRAFT' }]);
  outboundMocks.getOutboundDocumentDetail.mockResolvedValue({
    document: { id: 'out-1', document_no: 'OUT-001', status: 'DRAFT', customer_id: 'CUST-1' },
    lines: [{ id: 'line-1', product_id: 'PRD-1', requested_quantity: 3 }],
    reservations: [],
  });

  ledgerMocks.getMovementLedgerRows.mockResolvedValue({ data: [{ id: 'mv-1', product_id: 'PRD-1', inbound_qty: 2 }], error: null });
  ledgerMocks.getMovementLedgerSummary.mockResolvedValue({ data: { totalInboundQty: 2, totalOutboundQty: 1 }, error: null });
  ledgerMocks.getMovementTypeBreakdown.mockResolvedValue({ data: [], error: null });
});

describe('20B operational report preview UI integration', () => {
  it('shows preview and print actions on receiving detail page', async () => {
    renderWithLanguage(<ReceivingDetailPage />);

    expect(await screen.findByTestId('operational-report-preview-action')).toBeInTheDocument();
    expect(screen.getByTestId('operational-report-print-action')).toBeInTheDocument();
  });

  it('shows preview and print actions on outbound document detail panel', async () => {
    renderWithLanguage(<OutboundListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('operational-report-preview-action')).toBeInTheDocument();
      expect(screen.getByTestId('operational-report-print-action')).toBeInTheDocument();
    });
  });

  it('opens receiving report preview modal from receiving detail page', async () => {
    renderWithLanguage(<ReceivingDetailPage />);

    fireEvent.click(await screen.findByTestId('operational-report-preview-action'));

    expect(await screen.findByTestId('receiving-report-template')).toBeInTheDocument();
    expect(screen.getByTestId('report-print-button')).toBeInTheDocument();
  });

  it('shows preview and print actions on movement ledger report page', async () => {
    renderWithLanguage(<MovementLedgerReportPage />);

    await waitFor(() => {
      expect(screen.getByTestId('operational-report-preview-action')).toBeInTheDocument();
      expect(screen.getByTestId('operational-report-print-action')).toBeInTheDocument();
    });
  });
});
