import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { describe, expect, it, vi } from 'vitest';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'warehouse_admin', ready: true }),
}));

const projectRoot = resolve(__dirname, '../..');
const listPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingListPage.jsx');
const detailPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingDetailPage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readSource(path) {
  return readFileSync(path, 'utf8');
}

describe('Receiving operational write gate (customer deposit driven)', () => {
  it('Receiving list no longer exposes internal draft creation', () => {
    const source = readSource(listPagePath);

    expect(source).not.toContain('/operations/receiving/create');
    expect(source).not.toContain('DocumentToolbar');
    expect(source).not.toContain('receiving_create_internal_draft');
    expect(source).toContain('receiving-source-document-guidance');
    expect(source).toContain('CustomerDepositNotificationsSection');
  });

  it('Receiving list renders customer deposit section only', async () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="en">
          <ReceivingListPage />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('receiving-source-document-guidance')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('receiving-customer-deposit-section')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /Create Internal Receiving Draft/i })).not.toBeInTheDocument();
  });

  it('ReceivingDetailPage uses postReceivingDocument wrapper and no direct RPC or DML', () => {
    const source = readSource(detailPagePath);

    expect(source).toContain('postReceivingDocument');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toContain('supabase.from');
    expect(source).not.toContain('/operations/receiving/create');
  });

  it('createReceivingDocument is disabled in receivingService', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('Standalone receiving draft creation was removed');
    expect(source).not.toContain("supabase.rpc('tgd_rpc_create_receiving_draft'");
  });

  it('receivingService.postReceivingDocument uses tgd_rpc_post_receiving_document with p_document_id', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('postReceivingDocument');
    expect(source).toContain('tgd_rpc_post_receiving_document');
    expect(source).toContain('p_document_id: id');
  });
});
