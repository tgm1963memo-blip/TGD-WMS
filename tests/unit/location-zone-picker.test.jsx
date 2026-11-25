import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';

// Location pickers: after choosing a room, staff can pick one of its zones;
// the side is preset and the row list narrows to that zone's rows.

const getLocationGroups = vi.fn();
vi.mock('../../src/services/locationGroupService.js', () => ({
  getLocationGroups: (...a) => getLocationGroups(...a),
}));

const { useZonePicker, narrowSides, narrowRows, ZoneChips, resetZonePickerCache } = await import('../../src/components/location/ZonePicker.jsx');

const zoneA = { id: 'g1', zone_code: '41', name: 'โซน A · OVO', color: 'blue', side: 'L', row_from: 21, row_to: 30 };
const zoneB = { id: 'g2', zone_code: '41', name: 'โซน B', color: 'green', side: 'R', row_from: 25, row_to: 30 };
const other = { id: 'g3', zone_code: '42', name: 'โซน 42', color: 'purple', side: 'L', row_from: 1, row_to: 5 };

describe('zone narrowing', () => {
  it('keeps every side and row when no zone is picked', () => {
    expect(narrowSides(['L', 'R', 'A'], null)).toEqual(['L', 'R', 'A']);
    expect(narrowRows([1, 2, 3], 'L', null)).toEqual([1, 2, 3]);
  });

  it('limits sides and rows to the picked zone', () => {
    expect(narrowSides(['L', 'R', 'A'], zoneA)).toEqual(['L']);
    expect(narrowRows([19, 20, 21, 25, 30, 31], 'L', zoneA)).toEqual([21, 25, 30]);
    expect(narrowRows([19, 20, 21], 'R', zoneA)).toEqual([19, 20, 21]);
  });
});

describe('useZonePicker', () => {
  beforeEach(() => {
    resetZonePickerCache();
    getLocationGroups.mockReset();
    getLocationGroups.mockResolvedValue({ data: [zoneA, zoneB, other], error: null });
  });

  it('returns only the chosen room zones and clears the pick when the room changes', async () => {
    const { result, rerender } = renderHook(({ room }) => useZonePicker(room), { initialProps: { room: '41' } });
    await waitFor(() => expect(result.current.roomGroups.map((g) => g.id)).toEqual(['g1', 'g2']));
    result.current.setGroupId('g1');
    await waitFor(() => expect(result.current.activeGroup?.id).toBe('g1'));
    rerender({ room: '42' });
    await waitFor(() => expect(result.current.groupId).toBe(''));
    expect(result.current.roomGroups.map((g) => g.id)).toEqual(['g3']);
  });
});

describe('ZoneChips', () => {
  it('renders nothing for a room without zones', () => {
    const { container } = render(<ZoneChips roomGroups={[]} groupId="" onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lets staff pick a zone or go back to all rows', () => {
    const onPick = vi.fn();
    render(<ZoneChips roomGroups={[zoneA, zoneB]} groupId="g1" onPick={onPick} />);
    expect(screen.getByTestId('zone-chip-g1')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('zone-chip-g2'));
    expect(onPick).toHaveBeenLastCalledWith(zoneB);
    fireEvent.click(screen.getByText('ทุกแถว'));
    expect(onPick).toHaveBeenLastCalledWith(null);
  });
});
