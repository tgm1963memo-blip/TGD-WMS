import { describe, expect, it } from 'vitest';
import { splitBalanceByLocation, UNASSIGNED_LOCATION_LABEL } from '../../src/utils/stockBalanceExportUtils.js';

const pallet = (palletCode, remainingBoxes, remainingWeight = null, active = true) => ({
  palletCode, remainingBoxes, remainingWeight, active,
});

describe('splitBalanceByLocation', () => {
  it('gives one row per pallet, deriving kg from the lot kg-per-box when pallets have no weight', () => {
    // Real case FR260930001: 600 boxes / 3,000 kg on 6 pallets of 100 boxes.
    const rows = splitBalanceByLocation(600, 3000, [
      pallet('42-R-13-05', 100), pallet('42-R-13-01', 100), pallet('42-R-13-02', 100),
      pallet('42-R-13-06', 100), pallet('42-R-13-04', 100), pallet('42-R-13-03', 100),
    ]);
    expect(rows.map((r) => r.location)).toEqual(['42-R-13-01', '42-R-13-02', '42-R-13-03', '42-R-13-04', '42-R-13-05', '42-R-13-06']);
    expect(rows.every((r) => r.boxes === 100 && r.weight === 500)).toBe(true);
  });

  it('adds an unassigned row for balance not on any active pallet and skips emptied pallets', () => {
    const rows = splitBalanceByLocation(250, 1000, [
      pallet('A-01', 100), pallet('A-02', 0, 0, false), pallet('A-03', 50),
    ]);
    expect(rows).toEqual([
      { location: 'A-01', boxes: 100, weight: 400 },
      { location: 'A-03', boxes: 50, weight: 200 },
      { location: UNASSIGNED_LOCATION_LABEL, boxes: 100, weight: 400 },
    ]);
  });

  it('returns a single unassigned row for a lot with no pallets', () => {
    expect(splitBalanceByLocation(40, 400, [])).toEqual([{ location: UNASSIGNED_LOCATION_LABEL, boxes: 40, weight: 400 }]);
  });

  it('keeps the lot kg total exact when per-box kg does not divide evenly', () => {
    const rows = splitBalanceByLocation(3, 10, [pallet('B-01', 1), pallet('B-02', 1), pallet('B-03', 1)]);
    expect(rows.reduce((s, r) => s + r.weight, 0)).toBeCloseTo(10, 10);
  });
});
