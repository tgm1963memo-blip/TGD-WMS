import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// While pallet numbers are unknown, screens must not read as an empty
// warehouse: no 0 during loading, no "not set up" after a failed read.

const sections = [{
  id: 'z41', code: '41', name: 'ห้องเย็น 41', total: 1, totalCapacity: 12, used: 7, empty: 5, usedPct: 58,
  gridInfo: { rows: 1 }, rows: 1,
  locations: [{ id: 'l1', location_code: '41-L-01', capacity: 12, usedCount: 7 }],
}];

const getSectionsWithOccupancy = vi.fn();

vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: null }));
vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({ useUserRole: () => ({ role: 'warehouse_staff' }) }));
vi.mock('../../src/services/warehouseLayoutService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDefaultWarehouse: vi.fn(async () => ({ data: { id: 'w1' }, error: null })),
  getSectionsWithOccupancy: (...args) => getSectionsWithOccupancy(...args),
}));

const { WarehouseLocationSetupPage } = await import('../../src/features/admin/WarehouseLocationSetupPage.jsx');
const { WarehouseLayoutWidget } = await import('../../src/features/dashboard/WarehouseLayoutWidget.jsx');

function statValue(label) {
  return screen.getByText(label).previousElementSibling.textContent;
}

describe('WarehouseLocationSetupPage stats', () => {
  beforeEach(() => getSectionsWithOccupancy.mockReset());

  it('shows a placeholder instead of 0 while loading, then the real number', async () => {
    let finish;
    getSectionsWithOccupancy.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<MemoryRouter><WarehouseLocationSetupPage /></MemoryRouter>);

    await waitFor(() => expect(getSectionsWithOccupancy).toHaveBeenCalled());
    expect(statValue('Pallet ที่ใช้')).toBe('...');
    expect(statValue('Pallet ว่าง')).toBe('...');

    await act(async () => { finish({ data: sections, error: null, isEstimate: false }); });
    expect(statValue('Pallet ที่ใช้')).toBe('7');
  });

  it('shows a dash and the error when the pallet rows cannot be read', async () => {
    getSectionsWithOccupancy.mockResolvedValue({ data: [], error: new Error('อ่านข้อมูลพาเลทไม่ครบ') });
    render(<MemoryRouter><WarehouseLocationSetupPage /></MemoryRouter>);

    expect(await screen.findByText('อ่านข้อมูลพาเลทไม่ครบ')).toBeTruthy();
    expect(statValue('Pallet ที่ใช้')).toBe('—');
  });

  it('still shows 0 for a warehouse that really has no rooms', async () => {
    getSectionsWithOccupancy.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><WarehouseLocationSetupPage /></MemoryRouter>);

    expect(await screen.findByText(/ยังไม่มีห้อง/)).toBeTruthy();
    expect(statValue('Pallet ที่ใช้')).toBe('0');
  });
});

describe('WarehouseLayoutWidget read failure', () => {
  beforeEach(() => getSectionsWithOccupancy.mockReset());

  it('shows the error, not "not set up", when the first read fails', async () => {
    getSectionsWithOccupancy.mockResolvedValue({ data: [], error: new Error('อ่านข้อมูลพาเลทไม่ครบ') });
    render(<MemoryRouter><WarehouseLayoutWidget /></MemoryRouter>);

    expect((await screen.findByTestId('layout-load-error')).textContent).toContain('อ่านข้อมูลพาเลทไม่ครบ');
    expect(screen.queryByText('ยังไม่มีการตั้งค่าผังคลัง')).toBeNull();
  });

  it('keeps the last map and says so when a later refresh fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getSectionsWithOccupancy.mockResolvedValueOnce({ data: sections, error: null, isEstimate: false });
      getSectionsWithOccupancy.mockResolvedValue({ data: [], error: new Error('อ่านข้อมูลพาเลทไม่ครบ') });
      render(<MemoryRouter><WarehouseLayoutWidget /></MemoryRouter>);
      await screen.findByTestId('layout-view-list');

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });

      expect(screen.getByTestId('layout-stale-notice')).toBeTruthy();
      expect(screen.getByTestId('layout-view-list')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
