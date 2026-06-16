import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';
import { WithdrawalRequestListPage } from '../../src/features/operations/withdrawal/WithdrawalRequestListPage.jsx';

const receivingRpc = vi.hoisted(() => vi.fn());
const withdrawalRpc = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: receivingRpc.mockResolvedValue({ data: [], error: null }),
  createReceivingDocument: receivingRpc,
  postReceivingDocument: receivingRpc,
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'warehouse_staff', ready: true }),
}));

vi.mock('../../src/services/withdrawalRequestService.js', () => ({
  getWithdrawalRequests: withdrawalRpc.mockResolvedValue({ data: [], error: null }),
  createWithdrawalRequest: withdrawalRpc,
  confirmWithdrawalRequest: withdrawalRpc,
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
  it('receiving page renders customer deposit source guidance and notification table', async () => {
    renderPage(ReceivingListPage);

    await waitFor(() => {
      expect(screen.getByTestId('receiving-source-document-guidance')).toBeInTheDocument();
      expect(screen.getByText(/approved customer deposit request/i)).toBeInTheDocument();
      expect(screen.getByTestId('receiving-customer-deposit-section')).toBeInTheDocument();
      expect(screen.getByTestId('receiving-customer-deposit-table')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Create Internal Receiving Draft' })).toBeInTheDocument();
    });
  });

  it('withdrawal page renders customer withdrawal source guidance and demo link', async () => {
    renderPage(WithdrawalRequestListPage);

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-source-document-guidance')).toBeInTheDocument();
      expect(screen.getByText(/approved customer withdrawal request/i)).toBeInTheDocument();
      expect(screen.getByTestId('withdrawal-customer-request-demo-link')).toHaveAttribute(
        'href',
        '/customer/warehouse/picking-loading',
      );
      expect(screen.getByRole('link', { name: /Create draft|create/i })).toBeInTheDocument();
    });
  });

  it('list pages only load documents and do not invoke post RPC helpers', async () => {
    renderPage(ReceivingListPage);
    await waitFor(() => expect(receivingRpc).toHaveBeenCalled());

    renderPage(WithdrawalRequestListPage);
    await waitFor(() => expect(withdrawalRpc).toHaveBeenCalled());

    expect(receivingRpc).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'CONFIRMED' }));
    expect(withdrawalRpc.mock.calls.every((call) => call[0] !== 'post')).toBe(true);
  });
});
