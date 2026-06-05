import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

const {
  getOutboundDocumentDetail,
  listOutboundDocuments,
} = vi.hoisted(() => ({
  listOutboundDocuments: vi.fn(async () => []),
  getOutboundDocumentDetail: vi.fn(async () => ({
    document: null,
    lines: [],
    reservations: [],
  })),
}));

vi.mock('../../src/services/outboundPickingService.js', () => ({
  listOutboundDocuments: (...args) => listOutboundDocuments(...args),
  getOutboundDocumentDetail: (...args) => getOutboundDocumentDetail(...args),
  createOutboundDraft: vi.fn(),
  addOutboundLine: vi.fn(),
  reserveOutboundStock: vi.fn(),
  releaseOutboundReservation: vi.fn(),
}));

import { OutboundDraftPage } from '../../src/features/operations/outbound/OutboundDraftPage.jsx';
import { OutboundListPage } from '../../src/features/operations/outbound/OutboundListPage.jsx';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function renderWithRouter(ui) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listOutboundDocuments.mockReset();
  getOutboundDocumentDetail.mockReset();
  listOutboundDocuments.mockResolvedValue([]);
  getOutboundDocumentDetail.mockResolvedValue({ document: null, lines: [], reservations: [] });
});

describe('Sprint 14L outbound navigation and UX hardening', () => {
  it('sidebar navigation includes outbound list and draft routes', () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'รายการจ่ายสินค้าออก' })).toHaveAttribute('href', '/operations/outbound');
    expect(screen.getByRole('link', { name: 'ทดลองสร้างเอกสารจ่ายออก' })).toHaveAttribute('href', '/operations/outbound-draft');
  });

  it('list page shows safety note, loading state, empty permission hint, refresh, and draft link', async () => {
    const request = deferred();
    listOutboundDocuments.mockReturnValueOnce(request.promise);

    renderWithRouter(<OutboundListPage />);

    expect(screen.getByText('Read-only outbound list/detail. No post outbound. No stock movement OUT. No stock balance update.')).toBeInTheDocument();
    expect(screen.getByText('Loading outbound documents...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Draft Smoke UI' })).toHaveAttribute('href', '/operations/outbound-draft');

    request.resolve([]);

    expect(await screen.findByText('No outbound documents found or you may not have read permission.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(listOutboundDocuments).toHaveBeenCalledTimes(2);
    });
  });

  it('list page shows error state when list fetch fails', async () => {
    listOutboundDocuments.mockRejectedValueOnce(new Error('RLS read blocked'));

    renderWithRouter(<OutboundListPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('RLS read blocked');
  });

  it('draft page links back to outbound documents and keeps draft-only safety note', () => {
    renderWithRouter(<OutboundDraftPage />);

    expect(screen.getByRole('link', { name: 'Back to Outbound Documents' })).toHaveAttribute('href', '/operations/outbound');
    expect(screen.getByText('Draft/reserve/release only. No stock posting.')).toBeInTheDocument();
  });

  it('does not render forbidden outbound destructive actions', async () => {
    renderWithRouter(<OutboundListPage />);
    renderWithRouter(<OutboundDraftPage />);

    await screen.findByText('No outbound documents found or you may not have read permission.');

    expect(screen.queryByRole('button', { name: /Post Outbound/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Stock Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('source avoids outbound posting and dangerous stock mutation code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/components/layout/Sidebar.jsx',
      'src/app/navigation.js',
      'src/features/operations/outbound/OutboundListPage.jsx',
      'src/features/operations/outbound/OutboundDraftPage.jsx',
      'src/services/outboundPickingService.js',
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
