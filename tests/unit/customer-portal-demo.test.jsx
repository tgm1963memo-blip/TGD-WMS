import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { CustomerPortalDashboardPage } from '../../src/features/customer/CustomerPortalDashboardPage.jsx';
import { CustomerDepositRequestPage } from '../../src/features/customer/CustomerDepositRequestPage.jsx';
import { CustomerDepositRequestCreatePage } from '../../src/features/customer/CustomerDepositRequestCreatePage.jsx';
import { CustomerStockBalancePage } from '../../src/features/customer/CustomerStockBalancePage.jsx';
import { CustomerWithdrawalRequestPage } from '../../src/features/customer/CustomerWithdrawalRequestPage.jsx';
import { CustomerWithdrawalRequestCreatePage } from '../../src/features/customer/CustomerWithdrawalRequestCreatePage.jsx';
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
const createDepositRpc = vi.hoisted(() => vi.fn());
const submitDepositRpc = vi.hoisted(() => vi.fn());
const upsertDepositLineRpc = vi.hoisted(() => vi.fn());
const createWithdrawalRpc = vi.hoisted(() => vi.fn());
const upsertWithdrawalLineRpc = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/receivingService.js', () => ({
  createReceivingDraft: receivingRpc,
  confirmReceiving: receivingRpc,
}));

vi.mock('../../src/services/dispatchService.js', () => ({
  confirmDispatch: dispatchRpc,
  createDispatchDraft: dispatchRpc,
}));

vi.mock('../../src/features/customer/useCustomerPortalProfile.js', () => ({
  useCustomerPortalProfile: () => ({
    profile: { role: 'customer_admin', customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' },
    loading: false,
    error: null,
    role: 'customer_admin',
    customerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    canWriteCustomerRequests: true,
    isRequestProxy: false,
  }),
  getAdminPortalCustomerId: () => null,
  setAdminPortalCustomerId: vi.fn(),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn(async () => ({
    data: [{
      id: 'cat-prod-1',
      customer_product_code: 'CUS-CHKN-01',
      internal_product_code: 'FRZ-CHKN-01',
      product_name: 'Frozen Chicken Breast',
      temperature_type: 'FROZEN',
      pack_weight_kg: 10,
      uom: 'KG',
    }],
    error: null,
  })),
}));

vi.mock('../../src/services/customerPortalDashboardService.js', () => ({
  getCustomerPortalDashboardSummary: vi.fn(async () => ({
    data: {
      pendingDepositRequests: 1,
      pendingWithdrawalRequests: 0,
      availableStockLots: 2,
      lastActivity: '2026-06-08',
    },
    error: null,
  })),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  createCustomerDepositRequest: createDepositRpc,
  submitCustomerDepositRequest: submitDepositRpc,
  upsertCustomerDepositRequestLine: upsertDepositLineRpc,
  getCustomerStockBalance: vi.fn(async () => ({
    data: [{
      id: 'bal-1',
      product_id: 'prod-1',
      lot_id: 'lot-1',
      qty_available: 10,
      uom: 'KG',
    }],
    error: null,
  })),
  getDepositInventoryLines: vi.fn(async () => ({
    data: [{
      id: 'dep-line-1',
      deposit_request_id: 'dep-1',
      customer_product_code: 'CUS-CHKN-01',
      product_name: 'Frozen Chicken Breast',
      lot_no: 'LOT-TEST-01',
      weight_per_box: 20,
      actual_weight: 100,
      expected_weight: 100,
      request: {
        request_no: 'CDR-20260608-0001',
        expected_arrival_date: '2026-06-15',
      },
    }],
    error: null,
  })),
  listCustomerDepositRequests: vi.fn(async () => ({
    data: [{ id: 'dep-1', request_no: 'CDR-20260608-0001', status: 'DRAFT' }],
    error: null,
  })),
  listCustomerDepositRequestLines: vi.fn(async () => ({ data: [], error: null })),
  reviewCustomerDepositRequest: vi.fn(async () => ({ data: { status: 'ADMIN_REVIEWING' }, error: null })),
  getPendingDepositTotals: vi.fn(async () => ({ data: [], error: null })),
  getAllPendingDepositTotals: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/customerWithdrawalRequestService.js', () => ({
  createCustomerWithdrawalRequest: createWithdrawalRpc,
  upsertCustomerWithdrawalRequestLine: upsertWithdrawalLineRpc,
  submitCustomerWithdrawalRequest: vi.fn(async () => ({ data: { id: 'wd-new', status: 'SUBMITTED_BY_CUSTOMER' }, error: null })),
  updateCustomerWithdrawalRequestDraft: vi.fn(async () => ({ data: { id: 'wd-new' }, error: null })),
  getCustomerWithdrawalRequest: vi.fn(async () => ({ data: null, error: null })),
  listCustomerWithdrawalRequests: vi.fn(async () => ({ data: [], error: null })),
  listCustomerWithdrawalRequestLines: vi.fn(async () => ({ data: [], error: null })),
  reviewCustomerWithdrawalRequest: vi.fn(async () => ({ data: { status: 'ADMIN_REVIEWING' }, error: null })),
  listCustomerWithdrawalRequestServices: vi.fn(async () => ({ data: [], error: null })),
  upsertCustomerWithdrawalRequestService: vi.fn(async () => ({ data: { id: 'wd-svc-1' }, error: null })),
  deleteCustomerWithdrawalRequestService: vi.fn(async () => ({ data: true, error: null })),
  getPendingWithdrawalTotals: vi.fn(async () => ({ data: [], error: null })),
  getAllPendingWithdrawalTotals: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/productServiceRatesService.js', () => ({
  listAllProductServiceRates: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../../src/services/customerStorageBalanceReportService.js', () => ({
  getCustomerStorageBalanceRows: vi.fn(async () => ({
    data: [{
      id: 'bal-1',
      product_id: 'prod-1',
      lot_id: 'lot-1',
      pallet_id: 'plt-1',
      location_id: 'loc-1',
      qty_available: 10,
      uom: 'KG',
    }],
    error: null,
  })),
}));

vi.mock('../../src/services/customerPortalRequestHistoryService.js', () => ({
  listCustomerPortalRequestHistory: vi.fn(async () => ({
    data: [{
      id: 'req-1',
      request_no: 'CDR-20260608-0001',
      request_type: 'DEPOSIT',
      status: 'DRAFT',
      requested_date: '2026-06-15',
      note: 'Test',
      latest_action_note: 'Last action by demo',
      last_updated_at: '2026-06-08T10:00:00Z',
      document_type: 'CUSTOMER_DEPOSIT_REQUEST',
    }],
    error: null,
  })),
}));

vi.mock('../../src/services/customerDocumentTimelineService.js', () => ({
  listCustomerDocumentTimelineEvents: vi.fn(async () => ({
    data: [{ id: 'evt-1', action: 'CREATE_DRAFT', to_status: 'DRAFT' }],
    error: null,
  })),
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

describe('CUSTOMER-PORTAL-2F live data UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDepositRpc.mockResolvedValue({
      data: { id: 'dep-new', request_no: 'CDR-20260608-0002', status: 'DRAFT' },
      error: null,
    });
    upsertDepositLineRpc.mockResolvedValue({ data: { line_id: 'line-1' }, error: null });
    submitDepositRpc.mockResolvedValue({
      data: { id: 'dep-new', status: 'SUBMITTED_BY_CUSTOMER' },
      error: null,
    });
    createWithdrawalRpc.mockResolvedValue({
      data: { id: 'wd-new', withdrawal_no: 'CWR-20260608-0001', status: 'WITHDRAWAL_DRAFT' },
      error: null,
    });
    upsertWithdrawalLineRpc.mockResolvedValue({ data: { id: 'line-2', line_id: 'line-2' }, error: null });
  });

  it('renders customer portal dashboard with live banner', async () => {
    renderPage(CustomerPortalDashboardPage);
    expect(screen.getByTestId('customer-portal-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('customer-portal-live-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('customer-deposit-request-link')).toBeInTheDocument();
  });

  it('submits deposit draft through RPC services', async () => {
    renderPage(CustomerDepositRequestCreatePage);
    const form = screen.getByTestId('customer-deposit-request-form');

    await waitFor(() => {
      expect(screen.getByTestId('customer-deposit-product-picker-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('customer-deposit-product-picker-select'), {
      target: { value: 'cat-prod-1' },
    });
    fireEvent.change(screen.getByTestId('customer-deposit-weight-per-box'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('customer-deposit-box-count'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('customer-deposit-expected-arrival-date'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByTestId('customer-deposit-contact-name'), { target: { value: 'Demo User' } });
    fireEvent.change(screen.getByTestId('customer-deposit-contact-phone'), { target: { value: '0800000000' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createDepositRpc).toHaveBeenCalled();
    });
    expect(upsertDepositLineRpc).toHaveBeenCalled();
    expect(submitDepositRpc).toHaveBeenCalled();
    expect(receivingRpc).not.toHaveBeenCalled();
  });

  it('renders stock balance from live service', async () => {
    renderPage(CustomerStockBalancePage);
    await waitFor(() => {
      expect(screen.getByTestId('customer-stock-live-badge')).toBeInTheDocument();
    });
    expect(screen.getByTestId('customer-stock-balance-page')).toBeInTheDocument();
  });

  it('submits withdrawal draft through RPC services', async () => {
    renderPage(CustomerWithdrawalRequestCreatePage);
    const form = screen.getByTestId('customer-withdrawal-request-form');
    fireEvent.change(screen.getByTestId('customer-withdrawal-dispatch-date'), { target: { value: '2026-06-16' } });
    fireEvent.change(screen.getByTestId('customer-withdrawal-pickup-contact'), { target: { value: 'Demo Pickup' } });

    await waitFor(() => {
      expect(screen.getByTestId('customer-withdrawal-product-picker-select').querySelector('option[value="cat-prod-1"]')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('customer-withdrawal-product-picker-select'), { target: { value: 'cat-prod-1' } });

    // The LOT field is now a searchable combobox (input + type-to-filter
    // dropdown) instead of a native <select>, so open it and click the option.
    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-lot-select').tagName).toBe('INPUT');
    });
    fireEvent.focus(screen.getByTestId('withdrawal-lot-select'));
    await waitFor(() => {
      expect(screen.getByText('LOT-TEST-01')).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByText('LOT-TEST-01'));

    const weightInput = screen.getByTestId('customer-withdrawal-lines-table').querySelector('input[type="number"]');
    fireEvent.change(weightInput, { target: { value: '5' } });

    fireEvent.submit(form);

    await waitFor(() => {
      expect(createWithdrawalRpc).toHaveBeenCalled();
    });
    expect(upsertWithdrawalLineRpc).toHaveBeenCalled();
    expect(dispatchRpc).not.toHaveBeenCalled();
  });

  it('renders request history from live service', async () => {
    renderPage(CustomerRequestHistoryPage);
    await waitFor(() => {
      expect(screen.getByTestId('customer-request-history-table')).toBeInTheDocument();
    });
    expect(screen.getByText('CDR-20260608-0001')).toBeInTheDocument();
  });

  it('keeps warehouse execution pages in demo mode', () => {
    renderPage(CustomerWarehouseReceivingDemoPage);
    expect(screen.getByTestId('customer-portal-demo-banner')).toBeInTheDocument();
    expect(screen.getByTestId('pallet-card')).toBeInTheDocument();
  });

  it('keeps billing permission boundaries unchanged', () => {
    expect(canReadBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canReadBillingInvoiceDrafts('viewer')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('warehouse_manager')).toBe(false);
  });
});
