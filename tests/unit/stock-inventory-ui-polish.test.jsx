import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InventoryDashboardPage } from '../../src/features/dashboard/InventoryDashboardPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

vi.mock('../../src/services/inventoryDashboardService.js', () => ({
  getInventorySummary: vi.fn().mockResolvedValue({ data: { totalStockQty: 100, totalAllocatedQty: 10, lotCount: 5 }, error: null }),
  getStockBalanceRows: vi.fn().mockResolvedValue({ data: [{ id: '1', product_id: 'PRD-1', lot_id: 'LOT-1', qty_on_hand: 10, qty_allocated: 5, qty_available: 5 }], error: null }),
  getLowStockItems: vi.fn().mockResolvedValue({ data: [{ id: '2', product_id: 'PRD-2', lot_id: 'LOT-2', qty_on_hand: 1, qty_allocated: 0, qty_available: 1 }], error: null }),
  getExpiringLots: vi.fn().mockResolvedValue({ data: [], error: null }),
  getInventoryByWarehouse: vi.fn().mockResolvedValue({ data: [], error: null }),
  getInventoryByCustomer: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LanguageProvider initialLanguage="en">
        <InventoryDashboardPage />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('17F Stock / Inventory UI Polish', () => {
  it('Inventory/stock UI renders without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Inventory Control')).toBeInTheDocument();
    });
  });

  it('UI includes Stock Balance or Inventory Control', async () => {
    renderPage();
    expect(await screen.findByText('Inventory Control')).toBeInTheDocument();
    expect(screen.getByText('Stock Balances')).toBeInTheDocument();
  });

  it('UI includes Total Quantity or Total Qty', async () => {
    renderPage();
    expect(await screen.findByText('Total Quantity')).toBeInTheDocument();
  });

  it('UI includes Total Weight', async () => {
    renderPage();
    expect(await screen.findByText('Total Weight')).toBeInTheDocument();
  });

  it('UI includes Reserved Quantity', async () => {
    renderPage();
    expect(await screen.findByText('Reserved Quantity')).toBeInTheDocument();
  });

  it('UI includes Product, Lot, Location, Qty, Weight, Status', async () => {
    renderPage();
    expect(await screen.findAllByText('Product')).not.toHaveLength(0);
    expect(await screen.findAllByText('Lot')).not.toHaveLength(0);
    expect(await screen.findAllByText('Location')).not.toHaveLength(0);
    expect(await screen.findAllByText('Qty')).not.toHaveLength(0);
    expect(await screen.findAllByText('Weight')).not.toHaveLength(0);
    expect(await screen.findAllByText('Status')).not.toHaveLength(0);
  });

  it('UI includes Available and Reserved', async () => {
    renderPage();
    // In columns
    expect(await screen.findAllByText('Available')).not.toHaveLength(0);
    expect(await screen.findAllByText('Reserved')).not.toHaveLength(0);
  });

  it('UI includes safety panel elements', async () => {
    renderPage();
    expect(await screen.findAllByText('Production remains HOLD')).not.toHaveLength(0);
    expect(screen.getByText('No Production migration applied')).toBeInTheDocument();
    expect(screen.getByText('UI polish does not change stock movement behavior')).toBeInTheDocument();
    expect(screen.getByText('UI polish does not change stock balance calculation')).toBeInTheDocument();
  });
});
