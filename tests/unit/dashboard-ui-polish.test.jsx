import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../src/features/dashboard/DashboardPage.jsx';

vi.mock('../../src/services/readOnlyDashboardService.js', () => ({
  getReadOnlyDashboardSummary: vi.fn(() => Promise.resolve({
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
  })),
  getReadOnlyDashboardEmptySummary: vi.fn(() => ({
    stockBalanceRows: 0,
    stockMovementRows: 0,
    totalStockQuantity: 0,
    customerRows: 0,
    productRows: 0,
    lotRows: 0,
    locationRows: 0,
  })),
}));

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: vi.fn(() => Promise.resolve({
    data: { user: { id: 'test-user', email: 'test@example.com' } },
    error: null,
  })),
  subscribeToStagingAuth: vi.fn(() => ({
    unsubscribe: vi.fn(),
  })),
}));

vi.mock('../../src/services/supabaseConnectionReadinessService.js', () => ({
  summarizeSupabaseReadiness: vi.fn(() => ({
    ready: true,
    safe: true,
  })),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('17C Dashboard UI Polish', () => {
  it('Dashboard renders without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Operations Dashboard heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByText(/Cold storage WMS operational overview/i)).toBeInTheDocument();
    });
  });

  it('Dashboard includes Receiving Today', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Receiving Today')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Pending Putaway', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pending Putaway')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Pending Picking', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pending Picking')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Pending Post Outbound', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pending Post Outbound')).toBeInTheDocument();
    });
  });

  it('Dashboard includes workflow labels', async () => {
    renderPage();
    await waitFor(() => {
      const labels = ['Receiving', 'Putaway', 'Storage', 'Picking', 'Post Outbound'];
      labels.forEach(label => {
        expect(screen.getByText(label, { selector: '.workflow-step-name' })).toBeInTheDocument();
      });
    });
  });

  it('Dashboard includes Production remains HOLD', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Production remains HOLD')).toBeInTheDocument();
    });
  });

  it('Dashboard includes FINAL GO: Apply Outbound migrations 025-030 to Production', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('FINAL GO: Apply Outbound migrations 025-030 to Production')).toBeInTheDocument();
    });
  });

  it('Dashboard includes APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Feature gate default OFF', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Feature gate default OFF')).toBeInTheDocument();
    });
  });

  it('Dashboard includes Today task list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Today task list')).toBeInTheDocument();
      expect(screen.getByText('Review pending receiving documents')).toBeInTheDocument();
      expect(screen.getByText('Complete putaway sessions')).toBeInTheDocument();
    });
  });

  it('Dashboard includes System alerts', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('System alerts')).toBeInTheDocument();
      expect(screen.getByText('Production HOLD', { selector: '.alert-item.warning' })).toBeInTheDocument();
    });
  });
});
