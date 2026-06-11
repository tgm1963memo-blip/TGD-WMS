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
import { CustomerAdminDepositReviewPage } from '../../src/features/customer/CustomerAdminDepositReviewPage.jsx';
import { CustomerWarehouseReceivingDemoPage } from '../../src/features/customer/CustomerWarehouseReceivingDemoPage.jsx';
import { CustomerAdminReceivingVerificationPage } from '../../src/features/customer/CustomerAdminReceivingVerificationPage.jsx';
import { CustomerAdminWithdrawalReviewPage } from '../../src/features/customer/CustomerAdminWithdrawalReviewPage.jsx';
import { CustomerWarehousePickingLoadingDemoPage } from '../../src/features/customer/CustomerWarehousePickingLoadingDemoPage.jsx';
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

    fireEvent.change(screen.getByTestId('customer-product-code-input'), { target: { value: 'CUS-CHKN-01' } });
    fireEvent.change(screen.getByTestId('customer-deposit-product-code'), { target: { value: 'FRZ-CHKN-01' } });
    fireEvent.change(screen.getByTestId('customer-deposit-product-name'), { target: { value: 'Frozen Chicken Breast' } });
    fireEvent.change(screen.getByTestId('customer-deposit-qty'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('customer-deposit-expected-arrival-date'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByTestId('customer-deposit-contact-name'), { target: { value: 'Demo User' } });
    fireEvent.change(screen.getByTestId('customer-deposit-contact-phone'), { target: { value: '0800000000' } });
    fireEvent.submit(form);

    expect(screen.getByTestId('customer-deposit-demo-success-alert')).toBeInTheDocument();
    expect(screen.getByTestId('customer-deposit-status-timeline')).toHaveTextContent('CUSTOMER_NOTIFIED');
    expect(receivingRpc).not.toHaveBeenCalled();
  });

  it('previews, removes, and submits deposit attachments in local state only', () => {
    renderPage(CustomerDepositRequestPage);
    const file = new File(['demo'], 'packing-list-demo.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('customer-deposit-attachment-input');

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByTestId('customer-deposit-attachment-list')).toHaveTextContent(file.name);
    expect(screen.getByTestId('customer-deposit-attachment-demo-note')).toHaveTextContent('not uploaded');

    fireEvent.click(screen.getByTestId('customer-deposit-attachment-remove-button'));
    expect(screen.getByTestId('customer-deposit-attachment-list')).not.toHaveTextContent(file.name);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.submit(screen.getByTestId('customer-deposit-request-form'));
    expect(screen.getByTestId('customer-deposit-demo-success-alert')).toHaveTextContent(file.name);
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
    fireEvent.change(screen.getByTestId('customer-withdrawal-dispatch-date'), { target: { value: '2026-06-16' } });
    fireEvent.change(screen.getByTestId('customer-withdrawal-product-code'), { target: { value: 'CUS-CHKN-01' } });
    fireEvent.change(screen.getByTestId('customer-withdrawal-product-name'), { target: { value: 'Frozen Chicken' } });
    fireEvent.change(screen.getByTestId('customer-withdrawal-qty'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('customer-withdrawal-pickup-contact'), { target: { value: 'Demo Pickup' } });
    fireEvent.submit(form);

    expect(screen.getByTestId('customer-withdrawal-demo-success-alert')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-source-deposit-select')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-lot-select')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-picking-rule-select')).toBeInTheDocument();
    expect(screen.getByTestId('customer-withdrawal-status-timeline')).toHaveTextContent('LOADED_CONFIRMED');
    expect(dispatchRpc).not.toHaveBeenCalled();
  });

  it('renders request history table', () => {
    renderPage(CustomerRequestHistoryPage);
    expect(screen.getByTestId('customer-request-history-page')).toBeInTheDocument();
    expect(screen.getByTestId('customer-request-history-table')).toBeInTheDocument();
    expect(screen.getByText('CDR-20260612-0001')).toBeInTheDocument();
    expect(screen.getAllByTestId('customer-request-status-timeline').length).toBeGreaterThan(0);
  });

  it('renders admin deposit and receiving process demos', () => {
    const depositReview = renderPage(CustomerAdminDepositReviewPage);
    expect(screen.getByTestId('admin-deposit-review-table')).toHaveTextContent('CUS-CHICKEN-01');
    depositReview.unmount();

    const receiving = renderPage(CustomerWarehouseReceivingDemoPage);
    expect(screen.getByTestId('pallet-card')).toBeInTheDocument();
    expect(screen.getByTestId('packing-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('pallet-sticker-preview')).toBeInTheDocument();
    expect(screen.getByTestId('box-sticker-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-pallet-button'));
    expect(screen.getAllByTestId('pallet-card')).toHaveLength(2);
    receiving.unmount();

    renderPage(CustomerAdminReceivingVerificationPage);
    expect(screen.getByTestId('receiving-variance-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('notify-customer-preview-button'));
    expect(screen.getByTestId('customer-notification-preview')).toHaveTextContent('was not sent');
  });

  it('renders admin withdrawal and warehouse picking/loading demos', () => {
    const review = renderPage(CustomerAdminWithdrawalReviewPage);
    expect(screen.getByTestId('admin-withdrawal-review-table')).toHaveTextContent('SPECIFIC_DEPOSIT');
    review.unmount();

    renderPage(CustomerWarehousePickingLoadingDemoPage);
    expect(screen.getByTestId('picking-instruction-panel')).toBeInTheDocument();
    expect(screen.getByTestId('picking-packing-list-table')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('pallet-barcode-input'), { target: { value: 'PLT-DEMO-001' } });
    fireEvent.change(screen.getByTestId('box-barcode-input'), { target: { value: 'BOX-DEMO-001' } });
    fireEvent.click(screen.getByTestId('confirm-loaded-demo-button'));
    expect(screen.getByText(/No stock or dispatch record was changed/)).toBeInTheDocument();
    expect(dispatchRpc).not.toHaveBeenCalled();
  });

  it('keeps billing permission boundaries unchanged', () => {
    expect(canReadBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canReadBillingInvoiceDrafts('viewer')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('warehouse_manager')).toBe(false);
  });
});
