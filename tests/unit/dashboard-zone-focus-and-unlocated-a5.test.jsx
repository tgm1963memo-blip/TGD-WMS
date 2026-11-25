import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// 1. Dashboard map: clicking a zone card fades every row outside the zone.
// 2. "ยังไม่ระบุ Location" list: A5 sheets cover only a lot's unplaced boxes.

vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: null }));
vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({ useUserRole: () => ({ role: 'warehouse_staff' }) }));
vi.mock('../../src/services/warehouseLayoutService.js', () => ({
  DEFAULT_ROW_CAPACITY: 16,
  LOCATION_RESET_ROLES: ['admin'],
  confirmAndResetLocations: vi.fn(),
  getPalletDetailsAtLocation: vi.fn(async () => ({ data: { capacity: 12, pallets: [] } })),
  getSectionsWithOccupancy: vi.fn(async () => ({
    data: [{
      id: 'z41', code: '41', name: 'ห้องเย็น 41', total: 3, totalCapacity: 36, used: 5, empty: 31, usedPct: 14,
      groups: [{ id: 'g1', name: 'โซน A', color: 'blue', side: 'L', row_from: 1, row_to: 2 }],
      locations: [
        { id: 'l1', location_code: '41-L-01', capacity: 12, usedCount: 3 },
        { id: 'l2', location_code: '41-L-02', capacity: 12, usedCount: 2 },
        { id: 'r1', location_code: '41-R-01', capacity: 12, usedCount: 0 },
      ],
    }],
    error: null,
  })),
}));
vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn(async () => ({
    data: [{ customer_product_code: 'SPF122', allergen: 'ถั่วเหลือง', default_boxes_per_pallet: 20 }],
    error: null,
  })),
}));

const { WarehouseLayoutWidget } = await import('../../src/features/dashboard/WarehouseLayoutWidget.jsx');
const { buildUnlocatedA5Entries } = await import('../../src/features/dashboard/UnlocatedStockCard.jsx');
const { buildPalletStickerItems } = await import('../../src/utils/stickerPrint.jsx');

describe('dashboard zone focus', () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });

  it('fades rows outside the clicked zone and clears on a second click', async () => {
    render(<MemoryRouter><WarehouseLayoutWidget /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('layout-view-virtual'));
    const grid = screen.getByTestId('virtual-section-grid');
    const dimmedCount = () => within(grid).getAllByTestId('virtual-row').filter((r) => r.dataset.dimmed === 'true').length;
    expect(dimmedCount()).toBe(0);

    fireEvent.click(screen.getByTestId('zone-summary-g1'));
    expect(screen.getByTestId('zone-summary-g1')).toHaveAttribute('aria-pressed', 'true');
    expect(dimmedCount()).toBe(1); // only 41-R-01 is outside โซน A

    fireEvent.click(screen.getByTestId('zone-summary-g1'));
    expect(dimmedCount()).toBe(0);
  });
});

describe('A5 from the unlocated list', () => {
  const item = {
    lineId: 'line-1', customerId: 'c1', customerName: 'ไทย-เยอรมัน', trackingCode: 'FR261124002',
    productCode: 'SPF122', productName: 'เศษมันหมู', lotNo: 'L1', mfgDate: '2026-11-20', expDate: '2027-11-24',
    receivedAt: '2026-11-24', unlocatedBoxes: 40, inStockBoxes: 75, lotBoxes: 75, lotWeight: 750,
  };

  it('builds entries that split only the unplaced boxes, with catalog allergen and pallet size', async () => {
    const [entry] = await buildUnlocatedA5Entries([item]);
    expect(entry).toMatchObject({ lineId: 'line-1', manualOnly: true, splitBoxes: 40, boxesPerPallet: 20 });
    expect(entry.baseItem).toMatchObject({ trackingCode: 'FR261124002', lotBoxes: 75, allergenStatus: 'YES', allergenText: 'ถั่วเหลือง' });
  });

  it('splits the unplaced boxes but keeps the lot weight per box', () => {
    const sheets = buildPalletStickerItems({ trackingCode: 'FR1', lotBoxes: 75, lotWeight: 750 }, [], { count: 2, boxesPerPallet: 20, totalBoxes: 40 });
    expect(sheets.map((s) => [s.palletIndex, s.palletTotal, s.boxes, s.weight])).toEqual([
      [1, 2, 20, 200],
      [2, 2, 20, 200],
    ]);
  });
});
