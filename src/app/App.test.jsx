import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { Outlet } from 'react-router-dom';
import App from './App.jsx';
import { getTranslation } from '../i18n/translationCatalog.js';

const mockAuthContextValue = {
  session: { user: { email: 'uat@example.com' } },
  loading: false,
  isAuthenticated: true,
};

vi.mock('../features/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => mockAuthContextValue),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: vi.fn(() => ({ role: 'admin', ready: true })),
  UserRoleProvider: ({ children }) => children,
}));

vi.mock('../features/auth/RoutePermissionGuard.jsx', () => ({
  RoutePermissionGuard: () => <Outlet />,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BrowserRouter: ({ children }) => (
      <actual.MemoryRouter initialEntries={[window.location.pathname]}>
        {children}
      </actual.MemoryRouter>
    ),
  };
});

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then(resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('../services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn(async () => ({ data: [], error: null })),
  getAllCustomerStockBalances: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  getReceivingDocumentById: vi.fn(async () => ({ data: null, error: null })),
  getReceivingStockMovements: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../services/withdrawalRequestService.js', () => ({
  getWithdrawalRequests: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../services/inventoryBalanceService.js', () => ({
  getInventoryBalanceRows: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../services/masterDataService.js', () => ({
  getCustomers: vi.fn(async () => ({ data: [], error: null })),
  getProducts: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../services/warehouseLayoutService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getActiveLocations: vi.fn(async () => ({ data: [], error: null })),
    getSectionsWithOccupancy: vi.fn(async () => ({ data: [], error: null })),
  };
});

vi.mock('../services/movementLedgerReportService.js', () => ({
  getMovementLedgerRows: vi.fn(async () => ({ data: [], error: null })),
  getMovementLedgerSummary: vi.fn(async () => ({ data: {}, error: null })),
  getMovementTypeBreakdown: vi.fn(async () => ({ data: [], error: null })),
  getConfirmedDepositReceiptRows: vi.fn(async () => ({ data: [], error: null })),
  getConfirmedWithdrawalRows: vi.fn(async () => ({ data: [], error: null })),
  summarizeMovements: vi.fn(() => ({
    totalMovementRows: 0,
    totalInboundQty: 0,
    totalOutboundQty: 0,
    netMovementQty: 0,
    uniqueCustomers: 0,
    uniqueLots: 0,
    uniquePallets: 0,
  })),
  groupByMovementType: vi.fn(() => []),
}));

vi.mock('../services/userProfileService.js', () => ({
  getCurrentUserProfile: vi.fn(async () => ({
    data: { role: 'admin', is_active: true, customer_id: null, display_name: 'Admin' },
    error: null,
  })),
}));

vi.mock('../services/userManagementService.js', () => ({
  listUsers: vi.fn(async () => ({ data: [], error: null })),
  getUserProfiles: vi.fn(async () => ({ data: [], error: null })),
  createAuthUser: vi.fn(async () => ({ data: { authUserId: 'auth-1' }, error: null })),
  upsertUserProfile: vi.fn(async () => ({ data: {}, error: null })),
  setUserProfileActive: vi.fn(async () => ({ data: {}, error: null })),
  ALL_ASSIGNABLE_ROLES: [],
  CUSTOMER_PORTAL_ROLES: ['customer_admin', 'customer_user'],
}));

vi.mock('../services/handheldAuthService.js', () => ({
  listHandheldStaffProfiles: vi.fn(async () => ({ data: [], error: null })),
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TGC WMS' })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: getTranslation('operations_dashboard', 'th') })).toBeInTheDocument();
  });

  it.each([
    ['/dashboard', getTranslation('operations_dashboard', 'th'), 'heading'],
    ['/master/customers', 'ข้อมูลลูกค้า', 'heading'],
    ['/operations/receiving', getTranslation('receiving', 'th'), 'heading'],
    ['/inventory', 'ยอดคงเหลือสินค้า', 'heading'],
    ['/reports/movement-ledger', /รายงานการเคลื่อนไหวสินค้าของลูกค้า/, 'heading'],
    ['/operations/withdrawal-requests', 'Withdrawal Requests', 'heading-multiple'],
    ['/admin/users', 'จัดการผู้ใช้', 'heading'],
    ['/handheld', /Handheld/i, 'text'],
  ])('renders %s route', async (path, title, queryType) => {
    window.history.pushState({}, '', path);
    render(<App />);

    await waitFor(() => {
      if (queryType === 'text') {
        expect(screen.getByText(title)).toBeInTheDocument();
      } else if (queryType === 'heading-multiple') {
        expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0);
      } else if (title instanceof RegExp) {
        expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      } else {
        expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      }
    });

    expect(screen.queryByText('Sprint status: placeholder only')).not.toBeInTheDocument();
  });
});
