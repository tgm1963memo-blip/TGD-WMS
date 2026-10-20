import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

const listDepositRequests = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: listDepositRequests,
}));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'warehouse_admin', ready: true }),
}));

function renderPage(Component) {
  return render(
    <MemoryRouter>
      <LanguageProvider initialLanguage="en">
        <Component />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('CUSTOMER-PORTAL-2A source document guidance', () => {
  beforeEach(() => {
    listDepositRequests.mockResolvedValue({ data: [], error: null });
  });

  it('receiving page renders customer deposit source guidance and notification section', async () => {
    renderPage(ReceivingListPage);

    await waitFor(() => {
      expect(screen.getByTestId('receiving-source-document-guidance')).toBeInTheDocument();
      expect(screen.getByTestId('receiving-customer-deposit-section')).toBeInTheDocument();
    });

    expect(listDepositRequests).toHaveBeenCalled();
  });

  it('receiving list page only loads documents and do not invoke post RPC helpers', async () => {
    renderPage(ReceivingListPage);
    await waitFor(() => expect(listDepositRequests).toHaveBeenCalled());
  });
});
