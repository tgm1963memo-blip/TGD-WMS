import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  confirmOutboundPickDraft,
  getOutboundDocumentDetail,
} = vi.hoisted(() => ({
  confirmOutboundPickDraft: vi.fn(),
  getOutboundDocumentDetail: vi.fn(),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  confirmOutboundPickDraft: (...args) => confirmOutboundPickDraft(...args),
  getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
}));

import { PickingDraftWorkflowPage } from '../../src/features/operations/picking/PickingDraftWorkflowPage.jsx';

const validDocumentId = '11111111-1111-4111-8111-111111111111';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PickingDraftWorkflowPage />
    </MemoryRouter>,
  );
}

function submitDocumentId(value) {
  fireEvent.change(screen.getByLabelText('Picking outbound document id'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Load Document Detail' }));
}

beforeEach(() => {
  confirmOutboundPickDraft.mockReset();
  getOutboundDocumentDetail.mockReset();
});

describe('Sprint 14Q picking validation and error UX hardening', () => {
  it('empty document_id shows required message and does not call service', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Load Document Detail' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Outbound Document ID is required.');
    expect(getOutboundDocumentDetail).not.toHaveBeenCalled();
  });

  it('invalid UUID shows UUID message and does not call service', async () => {
    renderPage();

    submitDocumentId('not-a-uuid');

    expect(await screen.findByRole('alert')).toHaveTextContent('Outbound Document ID must be a valid UUID.');
    expect(getOutboundDocumentDetail).not.toHaveBeenCalled();
  });

  it('shows loading text and disables load button while loading', async () => {
    const request = deferred();
    getOutboundDocumentDetail.mockReturnValueOnce(request.promise);
    renderPage();

    submitDocumentId(validDocumentId);

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    expect(screen.getByText('Loading outbound document detail...')).toBeInTheDocument();

    request.resolve({
      document: {
        id: validDocumentId,
        document_no: 'OB-14Q-001',
        status: 'RESERVED',
      },
      lines: [],
      reservations: [],
    });

    expect(await screen.findByText('OB-14Q-001')).toBeInTheDocument();
  });

  it('shows not found or permission message for empty response', async () => {
    getOutboundDocumentDetail.mockResolvedValueOnce(null);
    renderPage();

    submitDocumentId(validDocumentId);

    expect(await screen.findByText('Outbound document was not found or you do not have permission to view it.')).toBeInTheDocument();
  });

  it('shows friendly service error message without raw stack details', async () => {
    getOutboundDocumentDetail.mockRejectedValueOnce(new Error('permission denied for table tgd_outbound_documents'));
    renderPage();

    submitDocumentId(validDocumentId);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load outbound document detail. Please check the document ID or your permission.');
    expect(alert).not.toHaveTextContent('permission denied for table');
  });

  it('shows friendly service error message when service returns error object', async () => {
    getOutboundDocumentDetail.mockResolvedValueOnce({ error: new Error('RLS blocked') });
    renderPage();

    submitDocumentId(validDocumentId);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load outbound document detail. Please check the document ID or your permission.');
  });

  it('shows empty lines and reservations messages', async () => {
    getOutboundDocumentDetail.mockResolvedValueOnce({
      document: {
        id: validDocumentId,
        document_no: 'OB-EMPTY-14Q',
        status: 'RESERVED',
      },
      lines: [],
      reservations: [],
    });
    renderPage();

    submitDocumentId(validDocumentId);

    expect(await screen.findByText('No outbound lines found for this document.')).toBeInTheDocument();
    expect(screen.getByText('No outbound reservations found for this document.')).toBeInTheDocument();
  });

  it('shows local-only note helper text and keeps safety note visible', () => {
    renderPage();

    expect(screen.getByText('Picking draft workflow only. No stock posting. No stock movement OUT. No stock balance update.')).toBeInTheDocument();
    expect(screen.getByText('This note is local-only and is not saved to the database.')).toBeInTheDocument();
  });

  it('does not render unsafe action buttons', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Confirm Pick/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('source and doc avoid dangerous code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/features/operations/picking/PickingDraftWorkflowPage.jsx',
      'src/services/outboundPickingService.js',
      'docs/14Q_PICKING_VALIDATION_ERROR_UX_HARDENING.md',
    ];
    const source = sourcePaths
      .map((sourcePath) => fs.readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'))
      .join('\n');

    expect(source).toContain('postOutboundDocumentDraft');
    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/delete\s+from/i);
    expect(source).not.toMatch(/\btruncate\b/i);
  });
});
