import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: null }));
vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({ useUserRole: () => ({ role: 'warehouse_staff' }) }));
vi.mock('../../src/services/warehouseLayoutService.js', () => ({
  DEFAULT_ROW_CAPACITY: 16,
  LOCATION_RESET_ROLES: ['admin'],
  confirmAndResetLocations: vi.fn(),
  getPalletDetailsAtLocation: vi.fn(async () => ({ data: { capacity: 12, pallets: [] } })),
  getSectionsWithOccupancy: vi.fn(async () => ({
    data: [{
      id: 'z41', code: '41', name: 'ห้องเย็น 41', total: 5, totalCapacity: 60, used: 17, empty: 43, usedPct: 28,
      locations: [
        { id: 'l0', location_code: '41-L-00', capacity: 12, usedCount: 0 },
        { id: 'l1', location_code: '41-L-01', capacity: 12, usedCount: 3 },
        { id: 'l30', location_code: '41-L-30', capacity: 12, usedCount: 0 },
        { id: 'r1', location_code: '41-R-01', capacity: 12, usedCount: 14 },
        { id: 'r2', location_code: '41-R-02', capacity: 12, usedCount: 0 },
      ],
    }],
    error: null,
  })),
}));

const { WarehouseLayoutWidget } = await import('../../src/features/dashboard/WarehouseLayoutWidget.jsx');

describe('WarehouseLayoutWidget virtual view', () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });

  it('switches to the virtual view with rows from 30 at the top down to รอจ่าย by the door', async () => {
    render(<MemoryRouter><WarehouseLayoutWidget /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('layout-view-virtual'));

    const grid = screen.getByTestId('virtual-section-grid');
    const labels = within(grid).getAllByTestId('virtual-row').map((row) => row.getAttribute('aria-label'));
    expect(labels).toEqual([
      '41-L-30 แถว 30 ใช้ 0 จาก 12 pallet',
      '41-L-01 แถว 1 ใช้ 3 จาก 12 pallet',
      '41-L-00 รอจ่าย ใช้ 0 จาก 12 pallet',
      '41-R-02 แถว 2 ใช้ 0 จาก 12 pallet',
      '41-R-01 แถว 1 ใช้ 14 จาก 12 pallet',
    ]);
    expect(within(grid).getByText('ทางเดินรถโฟล์คลิฟท์')).toBeTruthy();
    expect(within(grid).getByText(/ประตูห้อง/)).toBeTruthy();
    expect(window.localStorage.getItem('tgd.warehouseLayout.viewMode')).toBe('virtual');
  });

  it('keeps the list view as the default', async () => {
    render(<MemoryRouter><WarehouseLayoutWidget /></MemoryRouter>);
    expect(await screen.findByTestId('layout-view-list')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('virtual-section-grid')).toBeNull();
  });
});
