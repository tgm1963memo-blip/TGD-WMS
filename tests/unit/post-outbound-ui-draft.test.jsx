import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validDocumentId = '11111111-1111-4111-8111-111111111111';
const validLineId = '22222222-2222-4222-8222-222222222222';
const validReservationId = '33333333-3333-4333-8333-333333333333';

const pickedDetail = {
  document: {
    id: validDocumentId,
    document_no: 'OB-15D-001',
    status: 'PICKED',
    customer_id: 'customer-1',
    requested_ship_date: '2026-06-05',
    created_at: '2026-06-05T09:00:00Z',
  },
  lines: [
    {
      id: validLineId,
      product_id: 'product-1',
      lot_id: 'lot-1',
      requested_quantity: 1,
      picked_quantity: 1,
      status: 'PICKED',
    },
  ],
  reservations: [
    {
      id: validReservationId,
      outbound_line_id: validLineId,
      location_id: 'location-1',
      status: 'CONSUMED',
    },
  ],
};

const confirmedDetail = {
  ...pickedDetail,
  document: {
    ...pickedDetail.document,
    status: 'CONFIRMED',
  },
};

const {
  confirmOutboundPickDraft,
  getOutboundDocumentDetail,
  postOutboundDocumentDraft,
} = vi.hoisted(() => ({
  confirmOutboundPickDraft: vi.fn(),
  getOutboundDocumentDetail: vi.fn(),
  postOutboundDocumentDraft: vi.fn(),
}));

async function renderPage({ enabled = false, detail = pickedDetail } = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_ENABLE_POST_OUTBOUND_UI', enabled ? 'true' : 'false');

  getOutboundDocumentDetail.mockReset();
  getOutboundDocumentDetail.mockResolvedValue(detail);
  confirmOutboundPickDraft.mockReset();
  postOutboundDocumentDraft.mockReset();
  postOutboundDocumentDraft.mockResolvedValue({
    status: 'CONFIRMED',
    outbound_document_id: validDocumentId,
    post_reference: 'POST-15D-001',
    movement_count: 1,
  });

  vi.doMock('../../src/services/outboundPickingService.js', () => ({
    confirmOutboundPickDraft: (...args) => confirmOutboundPickDraft(...args),
    getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
    postOutboundDocumentDraft: (...args) => postOutboundDocumentDraft(...args),
  }));

  const { PickingDraftWorkflowPage } = await import('../../src/features/operations/picking/PickingDraftWorkflowPage.jsx');

  return render(
    <MemoryRouter>
      <PickingDraftWorkflowPage />
    </MemoryRouter>,
  );
}

async function loadDocumentDetail() {
  fireEvent.change(screen.getByLabelText('Picking outbound document id'), { target: { value: validDocumentId } });
  fireEvent.click(screen.getByRole('button', { name: 'Load Document Detail' }));

  await waitFor(() => {
    expect(getOutboundDocumentDetail).toHaveBeenCalledWith(validDocumentId);
  });
  expect(await screen.findByText('OB-15D-001')).toBeInTheDocument();
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Sprint 15D Post Outbound UI draft', () => {
  it('renders Post Outbound section and disabled safety gate message by default', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Post Outbound Draft' })).toBeInTheDocument();
    expect(screen.getByText('Post Outbound UI is disabled by safety gate.')).toBeInTheDocument();
    expect(screen.getByText('Post Outbound creates PICK_CONFIRM movement and decreases stock balance. Use only after document is fully picked.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Post Outbound Draft/i })).not.toBeInTheDocument();
  });

  it('when gate enabled and document PICKED, post reference input renders', async () => {
    await renderPage({ enabled: true });
    await loadDocumentDetail();

    expect(screen.getByLabelText('Post outbound post reference')).toBeInTheDocument();
    expect(screen.getByLabelText('Post outbound confirmation acknowledgment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post Outbound Draft' })).toBeInTheDocument();
  });

  it('shows status gate message when loaded document is not PICKED', async () => {
    await renderPage({
      enabled: true,
      detail: {
        ...pickedDetail,
        document: { ...pickedDetail.document, status: 'RESERVED' },
      },
    });
    await loadDocumentDetail();

    expect(screen.getByText('Post Outbound is available only for PICKED documents.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Post Outbound Draft/i })).not.toBeInTheDocument();
  });

  it('validates missing post reference before service call', async () => {
    await renderPage({ enabled: true });
    await loadDocumentDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Post Outbound Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Post reference is required.');
    expect(postOutboundDocumentDraft).not.toHaveBeenCalled();
  });

  it('requires confirmation acknowledgment before service call', async () => {
    await renderPage({ enabled: true });
    await loadDocumentDetail();

    fireEvent.change(screen.getByLabelText('Post outbound post reference'), { target: { value: 'POST-15D-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Outbound Draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Posting requires confirmation acknowledgment.');
    expect(postOutboundDocumentDraft).not.toHaveBeenCalled();
  });

  it('successful post calls wrapper, renders result, and reloads detail', async () => {
    await renderPage({ enabled: true });
    await loadDocumentDetail();
    getOutboundDocumentDetail.mockResolvedValueOnce(confirmedDetail);

    fireEvent.change(screen.getByLabelText('Post outbound post reference'), { target: { value: 'POST-15D-001' } });
    fireEvent.click(screen.getByLabelText('Post outbound confirmation acknowledgment'));
    fireEvent.click(screen.getByRole('button', { name: 'Post Outbound Draft' }));

    await waitFor(() => {
      expect(postOutboundDocumentDraft).toHaveBeenCalledWith({
        outboundDocumentId: validDocumentId,
        postReference: 'POST-15D-001',
        note: null,
      });
    });

    expect(await screen.findByText('Post outbound completed.')).toBeInTheDocument();
    expect(screen.getByText(/movement_count/)).toBeInTheDocument();
    expect(getOutboundDocumentDetail).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Post Outbound is complete for this confirmed document.')).toBeInTheDocument();
  });

  it('service error shows friendly message without raw stack trace', async () => {
    await renderPage({ enabled: true });
    await loadDocumentDetail();
    postOutboundDocumentDraft.mockRejectedValueOnce(new Error('insufficient stock_balance for reservation'));

    fireEvent.change(screen.getByLabelText('Post outbound post reference'), { target: { value: 'POST-15D-ERR' } });
    fireEvent.click(screen.getByLabelText('Post outbound confirmation acknowledgment'));
    fireEvent.click(screen.getByRole('button', { name: 'Post Outbound Draft' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to post outbound document. Please check document status, stock availability, reference, or permission.');
    expect(alert).not.toHaveTextContent('insufficient stock_balance');
  });

  it('does not render unsafe buttons', async () => {
    await renderPage({ enabled: true });

    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('source and docs avoid direct dangerous SQL references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/features/operations/picking/PickingDraftWorkflowPage.jsx',
      'src/services/outboundPickingService.js',
    ];
    const source = sourcePaths
      .map((sourcePath) => fs.readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/delete\s+from/i);
    expect(source).not.toMatch(/\btruncate\b/i);
  });
});
