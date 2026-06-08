import fs from 'node:fs';
import path from 'node:path';
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
    stockBalanceRows: 12,
    stockMovementRows: 34,
    totalStockQuantity: 567,
    customerRows: 3,
    productRows: 4,
    lotRows: 5,
    locationRows: 6,
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
}));

vi.mock('../../src/services/supabaseConnectionReadinessService.js', () => ({
  summarizeSupabaseReadiness: () => ({
    ready: true,
    safe: true,
    urlConfigured: true,
    anonKeyConfigured: true,
    serviceRoleExposed: false,
    clientInitialized: true,
    schemaValid: true,
    connectionValid: true,
    issues: [],
    nextActions: [],
  }),
}));

vi.mock('../../src/features/auth/AuthContext.jsx', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }) => children,
}));

import { DashboardPage } from '../../src/features/dashboard/DashboardPage.jsx';

const repoRoot = process.cwd();
const dashboardPath = path.join(repoRoot, 'src/features/dashboard/DashboardPage.jsx');
const servicePath = path.join(repoRoot, 'src/services/readOnlyDashboardService.js');
const authServicePath = path.join(repoRoot, 'src/services/stagingAuthService.js');
const configPath = path.join(repoRoot, 'src/config/supabaseConfig.js');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('read-only staging dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.session = { user: { email: 'uat@example.com' } };
    authMock.loading = false;
    authMock.error = null;
    dashboardSummaryMock.data = {
      stockBalanceRows: 12,
      stockMovementRows: 34,
      totalStockQuantity: 567,
      customerRows: 3,
      productRows: 4,
      lotRows: 5,
      locationRows: 6,
    };
    dashboardSummaryMock.error = null;
    getReadOnlyDashboardSummaryMock.mockImplementation(() => Promise.resolve(dashboardSummaryMock));
  });

  afterEach(() => {
    cleanup();
  });

  it('does not read stock data without an authenticated session', async () => {
    authMock.session = null;

    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Operations Dashboard' })).toBeInTheDocument();

    await waitFor(() => {
      expect(getReadOnlyDashboardSummaryMock).not.toHaveBeenCalled();
    });

    expect(screen.getByText('0', { selector: '.workflow-step-value' })).toBeInTheDocument();
  });

  it('renders staging summary instead of placeholder-only dashboard status', async () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Operations Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Sprint status: placeholder only')).not.toBeInTheDocument();
    expect(screen.getByText(/Read-only staging data visualization/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getReadOnlyDashboardSummaryMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('567')).toBeInTheDocument();
    });
  });

  it('uses the read-only dashboard service from the dashboard page', () => {
    const source = readSource(dashboardPath);

    expect(source).toContain('readOnlyDashboardService.js');
    expect(source).toContain('getReadOnlyDashboardSummary');
    expect(source).not.toContain('Operational overview placeholder for the UI foundation.');
  });

  it('keeps the dashboard service limited to Supabase reads', () => {
    const source = readSource(servicePath);
    const authSource = readSource(authServicePath);
    const forbiddenPatterns = [
      /\.insert\s*\(/,
      /\.update\s*\(/,
      /\.delete\s*\(/,
      /\.upsert\s*\(/,
      /\.rpc\s*\(/,
      /service_role/i,
    ];

    forbiddenPatterns.forEach((pattern) => {
      expect(source).not.toMatch(pattern);
      expect(authSource).not.toMatch(pattern);
    });
    expect(source).toContain("getRowCount('tgd_stock_balances')");
    expect(source).toContain("getRowCount('tgd_stock_movements')");
    expect(source).toContain(".select('quantity')");
    expect(source).not.toContain('qty_on_hand');
    expect(authSource).toContain('signInWithPassword');
    expect(authSource).toContain('signOut');
    expect(authSource).toContain('getSession');
    expect(authSource).toContain('onAuthStateChange');
  });

  it('uses only public anon Supabase frontend env keys', () => {
    const serviceSource = readSource(servicePath);
    const authSource = readSource(authServicePath);
    const configSource = readSource(configPath);

    expect(serviceSource).not.toMatch(/VITE_SUPABASE_SERVICE/i);
    expect(serviceSource).not.toMatch(/SERVICE_ROLE/i);
    expect(authSource).not.toMatch(/VITE_SUPABASE_SERVICE/i);
    expect(authSource).not.toMatch(/SERVICE_ROLE/i);
    expect(configSource).toContain('VITE_SUPABASE_URL');
    expect(configSource).toContain('VITE_SUPABASE_ANON_KEY');
    expect(configSource).not.toContain('VITE_SUPABASE_SERVICE_ROLE');
  });
});
