import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { CustomerPortalDashboardPage } from '../../src/features/customer/CustomerPortalDashboardPage.jsx';
import { CustomerDepositRequestPage } from '../../src/features/customer/CustomerDepositRequestPage.jsx';
import { CustomerStockBalancePage } from '../../src/features/customer/CustomerStockBalancePage.jsx';
import { CustomerWithdrawalRequestPage } from '../../src/features/customer/CustomerWithdrawalRequestPage.jsx';
import { CustomerRequestHistoryPage } from '../../src/features/customer/CustomerRequestHistoryPage.jsx';
import {
  canReadBillingInvoiceDrafts,
  canWriteBillingInvoiceDrafts,
} from '../../src/security/billingInvoiceDraftPermissions.js';

const receivingRpc = vi.hoisted(() => vi.fn());
const dispatchRpc = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/receivingService.js', () => ({
  createReceivingDraft: receivingRpc,
  confirmReceiving: receivingRpc,
}));

vi.mock('../../src/services/dispatchService.js', () => ({
  confirmDispatch: dispatchRpc,
  createDispatchDraft: dispatchRpc,
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

describe('CUSTOMER-PORTAL-1 demo UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders customer portal dashboard', () => {
    renderPage(CustomerPortalDashboardPage);
    expect(screen.getByTestId('customer-portal-page')).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-demo-banner')).toBeInTheDocument();
    expect(screen.getByTestId('customer-deposit-request-link')).toBeInTheDocument();
    expect(screen.getByTestId('customer-stock-balance-link')).toBeInTheDocument();
    expect(screen.getByTestId('customer-withdrawal-request-link')).toBeInTheDocument();
    expect(screen.getByTestId('customer-request-history-link')).toBeInTheDocument();
  });

  it('renders deposit request form and demo submit works', () => {
    renderPage(CustomerDepositRequestPage);
    expect(screen.getByTestId('customer-deposit-request-page')).toBeInTheDocument();
    const form = screen.getByTestId('customer-deposit-request-form');
    const inputs = form.querySelectorAll('input');

    fireEvent.change(inputs[0], { target: { value: '2026-06-15' } });
    fireEvent.change(inputs[1], { target: { value: 'FRZ-CHKN-01' } });
    fireEvent.change(inputs[2], { target: { value: 'Frozen Chicken Breast' } });
    fireEvent.change(inputs[4], { target: { value: '10' } });
    fireEvent.change(inputs[6], { target: { value: 'Demo User' } });
    fireEvent.change(inputs[7], { target: { value: '0800000000' } });
    fireEvent.submit(form);

    expect(screen.getByTestId('customer-deposit-demo-success-alert')).toBeInTheDocument();
    expect(receivingRpc).not.toHaveBeenCalled();
  });

  it('renders stock balance table with demo badge', () => {
    renderPage(CustomerStockBalancePage);
    expect(screen.getByTestId('customer-stock-balance-page')).toBeInTheDocument();
    expect(screen.getByTestId('customer-stock-demo-badge')).toBeInTheDocument();
    expect(screen.getByTestId('customer-stock-balance-table')).toBeInTheDocument();
    expect(screen.getByText('FRZ-CHKN-01')).toBeInTheDocument();
  });

  it('renders withdrawal request form and demo submit works', () => {
    renderPage(CustomerWithdrawalRequestPage);
    expect(screen.getByTestId('customer-withdrawal-request-page')).toBeInTheDocument();
    const form = screen.getByTestId('customer-withdrawal-request-form');
    const inputs = form.querySelectorAll('input');

    fireEvent.change(inputs[0], { target: { value: '2026-06-16' } });
    fireEvent.change(inputs[1], { target: { value: 'FRZ-SFOD-02' } });
    fireEvent.change(inputs[2], { target: { value: 'Frozen Seafood Mix' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: 'Demo Pickup' } });
    fireEvent.submit(form);

    expect(screen.getByTestId('customer-withdrawal-demo-success-alert')).toBeInTheDocument();
    expect(dispatchRpc).not.toHaveBeenCalled();
  });

  it('renders request history table', () => {
    renderPage(CustomerRequestHistoryPage);
    expect(screen.getByTestId('customer-request-history-page')).toBeInTheDocument();
    expect(screen.getByTestId('customer-request-history-table')).toBeInTheDocument();
    expect(screen.getByText('CDR-20260612-0001')).toBeInTheDocument();
  });

  it('keeps billing permission boundaries unchanged', () => {
    expect(canReadBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canReadBillingInvoiceDrafts('viewer')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('warehouse_manager')).toBe(false);
  });
});
