import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  session: { user: { email: 'uat@example.com' } },
  loading: false,
  error: null,
}));

const dashboardSummaryMock = vi.hoisted(() => ({
  data: {
    stockBalanceRows: 100,
    stockMovementRows: 200,
    totalStockQuantity: 1500,
    customerRows: 10,
    productRows: 50,
    lotRows: 120,
    locationRows: 80,
  },
  error: null,
}));

const getReadOnlyDashboardSummaryMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(dashboardSummaryMock)),
);

const emptySummary = vi.hoisted(() => ({
  stockBalanceRows: 0,
  stockMovementRows: 0,
  totalStockQuantity: 0,
  customerRows: 0,
  productRows: 0,
  lotRows: 0,
  locationRows: 0,
}));

vi.mock('../../src/services/readOnlyDashboardService.js', () => ({
  getReadOnlyDashboardEmptySummary: () => ({ ...emptySummary }),
  getReadOnlyDashboardSummary: getReadOnlyDashboardSummaryMock,
  getPendingAdminDocuments: () => Promise.resolve({ data: [], error: null }),
}));

vi.mock('../../src/services/supabaseConnectionReadinessService.js', () => ({
  summarizeSupabaseReadiness: () => ({
    ready: true,
    safe: true,
  }),
}));

vi.mock('../../src/services/inventoryDashboardService.js', () => ({
  getInventorySummary: vi.fn().mockResolvedValue({ data: { totalStockQty: 0, totalAllocatedQty: 0, lotCount: 0 }, error: null }),
  getStockBalanceRows: vi.fn().mockResolvedValue({ data: [], error: null }),
  getLowStockItems: vi.fn().mockResolvedValue({ data: [], error: null }),
  getExpiringLots: vi.fn().mockResolvedValue({ data: [], error: null }),
  getInventoryByWarehouse: vi.fn().mockResolvedValue({ data: [], error: null }),
  getInventoryByCustomer: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../src/features/auth/AuthContext.jsx', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }) => children,
}));

import { DashboardPage } from '../../src/features/dashboard/DashboardPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { getTranslation } from '../../src/i18n/translationCatalog.js';

function renderPage(lang = 'en') {
  return render(
    <LanguageProvider initialLanguage={lang}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('17C Dashboard UI Polish', () => {
  beforeEach(() => {
    localStorage.removeItem('tgd_wms_lang');
    authMock.session = { user: { email: 'uat@example.com' } };
    getReadOnlyDashboardSummaryMock.mockImplementation(() => Promise.resolve(dashboardSummaryMock));
  });

  afterEach(() => {
    cleanup();
  });

  it('Dashboard renders without crashing', async () => {
    renderPage('en');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: getTranslation('operations_dashboard', 'en') })).toBeInTheDocument();
    });
  });

  it('Dashboard includes meeting overview KPI cards and safety messaging', async () => {
    renderPage('en');
    await waitFor(() => {
      expect(screen.getByText(getTranslation('total_products', 'en'))).toBeInTheDocument();
      expect(screen.getByText(getTranslation('open_receiving', 'en'))).toBeInTheDocument();
      expect(screen.getAllByText(getTranslation('stock_balance', 'en')).length).toBeGreaterThan(0);
      expect(screen.getByText('FINAL GO: Apply Outbound migrations 025-030 to Production')).toBeInTheDocument();
      expect(screen.getAllByText(/FINAL GO is NOT AUTHORIZED/i).length).toBeGreaterThan(0);
    });
  });

  it('Dashboard includes workflow labels and staging summary values', async () => {
    renderPage('en');
    await waitFor(() => {
      expect(screen.getByText(getTranslation('total_products', 'en'))).toBeInTheDocument();
      expect(screen.getByText(getTranslation('warehouses', 'en'))).toBeInTheDocument();
      expect(screen.getAllByText(getTranslation('stock_balance', 'en')).length).toBeGreaterThan(0);
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  it('Dashboard renders Thai-first labels when language is th', async () => {
    renderPage('th');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: getTranslation('operations_dashboard', 'th') })).toBeInTheDocument();
      expect(screen.getByText('งานวันนี้')).toBeInTheDocument();
    });
  });
});
