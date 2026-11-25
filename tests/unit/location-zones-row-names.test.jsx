import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  applyRowNamePattern,
  findLocationGroup,
  rowDisplayLabel,
  rowOptionLabel,
  validateLocationGroups,
} from '../../src/utils/locationGroupUtils.js';

// Zones (named runs of rows in a room) and custom row names are display
// labels only; location codes such as 41-L-30 never change.

describe('location group helpers', () => {
  const zoneA = { id: 'g1', name: 'โซน A', side: 'L', row_from: 21, row_to: 30, color: 'blue' };

  it('finds the zone a row belongs to by side and row range', () => {
    expect(findLocationGroup([zoneA], { side: 'L', row: 25 })).toBe(zoneA);
    expect(findLocationGroup([zoneA], { side: 'R', row: 25 })).toBeNull();
    expect(findLocationGroup([zoneA], { side: 'L', row: 20 })).toBeNull();
  });

  it('rejects overlapping zones on the same side and missing names', () => {
    expect(validateLocationGroups([zoneA, { ...zoneA, id: 'g2', name: 'โซน B', row_from: 30, row_to: 31 }])).toMatch(/ทับกัน/);
    expect(validateLocationGroups([zoneA, { ...zoneA, id: 'g2', name: 'โซน B', side: 'R' }])).toBe('');
    expect(validateLocationGroups([{ ...zoneA, name: ' ' }])).toMatch(/ชื่อ Zone/);
    expect(validateLocationGroups([{ ...zoneA, row_from: 9, row_to: 3 }])).toMatch(/ไม่ถูกต้อง/);
  });

  it('builds row names from a pattern', () => {
    expect(applyRowNamePattern('A{แถว}', 30, 'L')).toBe('A30');
    expect(applyRowNamePattern('{side}-{row}', 5, 'R')).toBe('R-5');
    expect(applyRowNamePattern('OVO-', 7, 'L')).toBe('OVO-7');
    expect(applyRowNamePattern('', 7, 'L')).toBe('');
  });

  it('labels rows with the custom name, falling back to the row number', () => {
    expect(rowDisplayLabel({ location_code: '41-L-30', display_name: 'A30' })).toBe('A30');
    expect(rowDisplayLabel({ location_code: '41-L-30', display_name: null })).toBe('แถว 30');
    expect(rowDisplayLabel({ location_code: '41-A-30' })).toBe('ทางเดิน 30');
    expect(rowOptionLabel(30, 'L', 'A30')).toBe('A30 (แถว 30)');
    expect(rowOptionLabel(30, 'L', '')).toBe('แถว 30');
  });
});

const saveLocationGroups = vi.fn();
const setLocationDisplayNames = vi.fn();
vi.mock('../../src/services/warehouseLayoutService.js', () => ({
  saveLocationGroups: (...a) => saveLocationGroups(...a),
  setLocationDisplayNames: (...a) => setLocationDisplayNames(...a),
}));
const { LocationZonesPanel } = await import('../../src/features/admin/LocationZonesPanel.jsx');

const section = {
  id: 'zone-41',
  code: '41',
  groups: [{ id: 'g1', name: 'โซน A · OVO', color: 'blue', side: 'L', row_from: 21, row_to: 23 }],
  locations: [20, 21, 22, 23].map((r) => ({ id: `l${r}`, location_code: `41-L-${r}`, capacity: 12 }))
    .concat([{ id: 'r21', location_code: '41-R-21', capacity: 12 }]),
};

describe('LocationZonesPanel', () => {
  beforeEach(() => { saveLocationGroups.mockReset(); setLocationDisplayNames.mockReset(); });

  it('names every row of the chosen zone from the pattern', async () => {
    setLocationDisplayNames.mockResolvedValue({ data: { updated: 3 }, error: null });
    const onChanged = vi.fn();
    render(<LocationZonesPanel section={section} onChanged={onChanged} />);
    fireEvent.change(screen.getByTestId('row-name-pattern'), { target: { value: 'A{แถว}' } });
    expect(screen.getByText(/ตัวอย่าง: A21, A22, A23/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('row-name-apply'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(setLocationDisplayNames).toHaveBeenCalledWith([
      { id: 'l21', displayName: 'A21' },
      { id: 'l22', displayName: 'A22' },
      { id: 'l23', displayName: 'A23' },
    ]);
  });

  it('blocks saving zones that overlap', async () => {
    render(<LocationZonesPanel section={section} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByText('+ เพิ่ม Zone'));
    fireEvent.change(screen.getByTestId('zone-name-1'), { target: { value: 'โซน ซ้อน' } });
    const fromInputs = screen.getAllByLabelText('จากแถว');
    const toInputs = screen.getAllByLabelText('ถึงแถว');
    fireEvent.change(fromInputs[1], { target: { value: '22' } });
    fireEvent.change(toInputs[1], { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('zone-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ทับกัน');
    expect(saveLocationGroups).not.toHaveBeenCalled();
  });

  it('saves valid zones for the room', async () => {
    saveLocationGroups.mockResolvedValue({ data: [], error: null });
    render(<LocationZonesPanel section={section} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByTestId('zone-save'));
    await waitFor(() => expect(saveLocationGroups).toHaveBeenCalled());
    const [zoneId, groups] = saveLocationGroups.mock.calls[0];
    expect(zoneId).toBe('zone-41');
    expect(groups).toEqual([expect.objectContaining({ name: 'โซน A · OVO', side: 'L', row_from: 21, row_to: 23 })]);
  });
});
