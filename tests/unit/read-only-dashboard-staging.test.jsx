import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../../src/features/dashboard/DashboardPage.jsx';

const mocks = vi.hoisted(() => ({
  getReadOnlyDashboardSummary: vi.fn(),
  getStagingSession: vi.fn(),
  subscribeToStagingAuth: vi.fn(),
}));

vi.mock('../../src/services/readOnlyDashboardService.js', () => ({
  getReadOnlyDashboardEmptySummary: () => ({
    stockBalanceRows: 0,
    stockMovementRows: 0,
    totalStockQuantity: 0,
    customerRows: 0,
    productRows: 0,
    lotRows: 0,
    locationRows: 0,
  }),
  getReadOnlyDashboardSummary: mocks.getReadOnlyDashboardSummary,
}));

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: mocks.getStagingSession,
  signInToStaging: vi.fn(),
  signOutFromStaging: vi.fn(),
  subscribeToStagingAuth: mocks.subscribeToStagingAuth,
}));

vi.mock('../../src/features/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({ session: { user: { email: 'uat@example.com' } }, loading: false, isAuthenticated: true })),
  AuthProvider: ({ children }) => children,
}));

const repoRoot = process.cwd();
const dashboardPath = path.join(repoRoot, 'src/features/dashboard/DashboardPage.jsx');
const servicePath = path.join(repoRoot, 'src/services/readOnlyDashboardService.js');
const authServicePath = path.join(repoRoot, 'src/services/stagingAuthService.js');
const configPath = path.join(repoRoot, 'src/config/supabaseConfig.js');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('read-only staging dashboard', () => {
  beforeEach(() => {
    mocks.getReadOnlyDashboardSummary.mockReset();
    mocks.getStagingSession.mockReset();
    mocks.subscribeToStagingAuth.mockReset();
    mocks.subscribeToStagingAuth.mockReturnValue({ unsubscribe: vi.fn() });
    mocks.getStagingSession.mockResolvedValue({
      data: { user: { email: 'uat@example.com' } },
      error: null,
    });
    mocks.getReadOnlyDashboardSummary.mockResolvedValue({
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
    });
  });

  it('shows auth required message and does not read stock data without a session', async () => {
    mocks.getStagingSession.mockResolvedValue({ data: null, error: null });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Please login to Staging to view live RLS data.')).toBeInTheDocument();
    expect(mocks.getReadOnlyDashboardSummary).not.toHaveBeenCalled();
  });

  it('renders staging summary instead of placeholder-only dashboard status', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Operations Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Sprint status: placeholder only')).not.toBeInTheDocument();
    expect(screen.getByText(/Read-only staging data visualization/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('12').length).toBeGreaterThan(0);
      expect(screen.getByText('567')).toBeInTheDocument();
    });
    expect(mocks.getReadOnlyDashboardSummary).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('uat@example.com')).toHaveLength(1);
  });

  it('uses the read-only dashboard service from the dashboard page', () => {
    const source = readSource(dashboardPath);

    expect(source).toContain("readOnlyDashboardService.js");
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
